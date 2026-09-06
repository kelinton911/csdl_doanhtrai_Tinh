/**
 * Tiện ích Chữ ký số PKI Ban Cơ yếu Chính phủ cho Webapp Frontend (P08)
 */

export interface SignatureVerifyResult {
  signatureId: string;
  documentType: string;
  documentId: string;
  signerName: string;
  certificateSerial: string;
  certificateIssuer: string;
  timestamp: string;
  status: 'VALID' | 'EXPIRED' | 'REVOKED' | 'INVALID';
  isValid: boolean;
  verificationMessage: string;
}

/**
 * Gọi API tạo Digest SHA-256 từ nội dung hồ sơ/tài liệu
 */
export async function generateDocumentDigest(
  documentType: string,
  documentId: string,
  payload?: Record<string, unknown>,
  token?: string,
) {
  const res = await fetch('/api/v1/digital-signature/generate-digest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({ documentType, documentId, payload }),
  });

  if (!res.ok) {
    throw new Error('Tạo Digest Hash thất bại');
  }

  return res.json();
}

/**
 * Gắn chữ ký số đã được tạo từ USB Token PKI vào cơ sở dữ liệu
 */
export async function attachDigitalSignature(
  params: {
    documentType: string;
    documentId: string;
    certificateSerial: string;
    signatureDigest: string;
    signatureValue: string;
    certificateIssuer?: string;
  },
  token?: string,
) {
  const res = await fetch('/api/v1/digital-signature/attach', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    throw new Error('Gắn chữ ký số thất bại');
  }

  return res.json();
}

/**
 * Xác thực chữ ký số PKI
 */
export async function verifyDigitalSignature(signatureId: string): Promise<SignatureVerifyResult> {
  const res = await fetch('/api/v1/digital-signature/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signatureId }),
  });

  if (!res.ok) {
    throw new Error('Xác thực chữ ký số thất bại');
  }

  return res.json();
}
