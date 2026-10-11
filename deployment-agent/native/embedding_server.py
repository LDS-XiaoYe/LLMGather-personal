"""Native MLX inference. No network model loading, shell execution or CPU fallback."""
import argparse
import json
import math
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def validate_input(payload):
    texts = payload.get("input")
    if isinstance(texts, str):
        texts = [texts]
    if not isinstance(texts, list) or not 1 <= len(texts) <= 32:
        raise ValueError("input must contain 1..32 texts")
    if any(not isinstance(text, str) or not text.strip() or len(text) > 32000 for text in texts):
        raise ValueError("invalid input text")
    return texts


def main():
    args = argparse.ArgumentParser()
    args.add_argument("--model-path", required=True)
    args.add_argument("--model-id", required=True)
    args.add_argument("--port", type=int, required=True)
    options = args.parse_args()
    folder = Path(options.model_path).resolve()
    if not (folder / "COMPLETE.json").is_file():
        raise RuntimeError("Model cache has not passed integrity verification")
    import mlx.core as mx
    from mlx_embeddings.utils import load
    if not mx.metal.is_available():
        raise RuntimeError("Metal unavailable; GPU mode does not fall back to CPU")
    mx.set_default_device(mx.gpu)
    model, tokenizer = load(str(folder))
    lock = threading.Lock()

    def embed(texts):
        with lock:
            encoded = tokenizer.batch_encode_plus(texts, return_tensors="np", padding=True, truncation=True, max_length=8192)
            output = model(mx.array(encoded["input_ids"]), attention_mask=mx.array(encoded["attention_mask"]))
            vectors = output.text_embeds
            mx.eval(vectors)
            rows = vectors.astype(mx.float32).tolist()
            if any(len(row) != 1024 or not all(math.isfinite(v) for v in row) or not any(row) for row in rows):
                raise RuntimeError("Invalid model output")
            tokens = int(encoded["attention_mask"].sum())
            return rows, tokens

    embed(["模型启动健康检查"])

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *unused):
            pass  # Never record input text or credentials.

        def reply(self, status, payload):
            data = json.dumps(payload, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if self.path != "/health":
                return self.reply(404, {"error": "not found"})
            self.reply(200, {"status": "ok", "device": "metal", "precision": "float16", "dimensions": 1024,
                             "activeMemoryBytes": mx.get_active_memory(), "peakMemoryBytes": mx.get_peak_memory()})

        def do_POST(self):
            if self.path not in ("/embeddings", "/v1/embeddings"):
                return self.reply(404, {"error": "not found"})
            try:
                length = int(self.headers.get("Content-Length", 0))
                if not 0 < length <= 1048576:
                    raise ValueError("invalid body length")
                payload = json.loads(self.rfile.read(length))
                if payload.get("model") != options.model_id:
                    raise ValueError("model identifier mismatch")
                texts = validate_input(payload)
                rows, tokens = embed(texts)
                self.reply(200, {"object": "list", "model": options.model_id,
                                 "data": [{"object": "embedding", "index": index, "embedding": row} for index, row in enumerate(rows)],
                                 "usage": {"prompt_tokens": tokens, "total_tokens": tokens}})
            except (ValueError, TypeError):
                self.reply(400, {"error": "invalid embeddings request"})
            except Exception:
                self.reply(503, {"error": "model inference failed"})

    ThreadingHTTPServer(("127.0.0.1", options.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
