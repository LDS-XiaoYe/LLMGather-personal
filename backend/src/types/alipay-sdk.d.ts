declare module 'alipay-sdk' {
  interface AlipaySdkConfig {
    appId: string;
    privateKey: string;
    keyType?: 'PKCS1' | 'PKCS8';
    alipayPublicKey?: string;
    gateway?: string;
    signType?: 'RSA2' | 'RSA';
    timeout?: number;
    camelcase?: boolean;
  }

  interface AlipayExecResult {
    code: string;
    msg: string;
    subCode?: string;
    subMsg?: string;
    [key: string]: any;
  }

  class AlipaySdk {
    constructor(config: AlipaySdkConfig);
    exec(method: string, params?: {
      formData?: import('alipay-sdk/lib/form').default;
      bizContent?: Record<string, unknown>;
      [key: string]: unknown;
    }): Promise<AlipayExecResult>;
    checkNotifySign(params: Record<string, string>): boolean;
  }

  export default AlipaySdk;
}

declare module 'alipay-sdk/lib/form' {
  class AlipayFormData {
    constructor();
    setMethod(method: 'get' | 'post'): void;
    addField(key: string, value: unknown): void;
  }

  export default AlipayFormData;
}
