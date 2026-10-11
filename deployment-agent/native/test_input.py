import unittest
from embedding_server import validate_input

class InputTest(unittest.TestCase):
    def test_single_and_batch(self):
        self.assertEqual(validate_input({"input": "中文"}), ["中文"])
        self.assertEqual(validate_input({"input": ["a", "b"]}), ["a", "b"])
    def test_invalid(self):
        for value in [None, [], [""], ["a"] * 33, [1], ["a" * 32001]]:
            with self.assertRaises(ValueError):
                validate_input({"input": value})

if __name__ == '__main__':
    unittest.main()
