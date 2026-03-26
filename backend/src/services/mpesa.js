import {
  MPESA_BASE_URL,
  MPESA_CALLBACK_URL,
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_ENVIRONMENT,
  MPESA_PASSKEY,
  MPESA_SHORTCODE,
} from "../config/env.js";

const toBasicAuthHeader = () => {
  if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET) {
    return null;
  }

  const token = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString("base64");
  return `Basic ${token}`;
};

export const hasDarajaCredentials = () => Boolean(MPESA_CONSUMER_KEY && MPESA_CONSUMER_SECRET);
export const hasStkPushCredentials = () => Boolean(MPESA_SHORTCODE && MPESA_PASSKEY && MPESA_CALLBACK_URL);

export const getDarajaConfig = () => ({
  environment: MPESA_ENVIRONMENT,
  baseUrl: MPESA_BASE_URL,
  configured: hasDarajaCredentials(),
  stkConfigured: hasStkPushCredentials(),
});

export const getDarajaAccessToken = async () => {
  const authorization = toBasicAuthHeader();
  if (!authorization) {
    return null;
  }

  const response = await fetch(`${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: {
      Authorization: authorization,
    },
  });

  if (!response.ok) {
    throw new Error(`Daraja OAuth failed with status ${response.status}`);
  }

  const data = await response.json();
  return typeof data?.access_token === "string" ? data.access_token : null;
};

export const buildStkPassword = (timestamp) => {
  if (!MPESA_SHORTCODE || !MPESA_PASSKEY) {
    return null;
  }

  return Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString("base64");
};

export const normalizePhoneNumber = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (digits.startsWith("254")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `254${digits.slice(1)}`;
  }

  if (digits.length === 9) {
    return `254${digits}`;
  }

  return digits;
};

export const sendDarajaStkPush = async ({ amount, phone, accountReference, transactionDesc }) => {
  if (!hasStkPushCredentials()) {
    throw new Error("MPESA_SHORTCODE, MPESA_PASSKEY and MPESA_CALLBACK_URL are required for real STK Push");
  }

  const accessToken = await getDarajaAccessToken();
  if (!accessToken) {
    throw new Error("Unable to obtain Daraja access token");
  }

  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const password = buildStkPassword(timestamp);
  if (!password) {
    throw new Error("Unable to build STK password");
  }

  const normalizedPhone = normalizePhoneNumber(phone);
  const numericAmount = Number(amount);

  const payload = {
    BusinessShortCode: String(MPESA_SHORTCODE),
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: numericAmount,
    PartyA: normalizedPhone,
    PartyB: String(MPESA_SHORTCODE),
    PhoneNumber: normalizedPhone,
    CallBackURL: MPESA_CALLBACK_URL,
    AccountReference: accountReference || "BillIT",
    TransactionDesc: transactionDesc || "BillIT payment",
  };

  const response = await fetch(`${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.errorMessage || data?.ResponseDescription || `Daraja STK failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
};
