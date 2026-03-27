const COMPANY_ID_FALLBACK = "default";

export const defaultOrganizationSettings = () => ({
  companyName: "",
  tradingName: "",
  registrationNumber: "",
  taxPin: "",
  supportEmail: "",
  supportPhone: "",
  address: "",
  website: "",
  invoicePrefix: "INV",
  billingCycleDay: 1,
  gracePeriodDays: 7,
  currency: "KES",
  timezone: "Africa/Nairobi",
  mpesaPaymentType: "",
  mpesaPaybill: "",
  mpesaAccount: "",
  mpesaTill: "",
  mpesaPhone: "",
  smsProvider: "",
  smsSenderId: "",
  emailHost: "",
  emailPort: 587,
  emailUser: "",
  emailFrom: "",
  radiusServer: "",
  radiusSecret: "",
  primaryRouter: "",
  notes: "",
});

export const normalizeCompanyId = (companyId) => {
  const normalized = String(companyId || "").trim();
  return normalized.length > 0 ? normalized : COMPANY_ID_FALLBACK;
};

const normalizeSettingsRecord = (settings) => ({
  ...defaultOrganizationSettings(),
  ...(settings && typeof settings === "object" ? settings : {}),
});

export const normalizeSettingsStore = (store) => {
  const normalized = { ...store };
  const nextSettingsByCompany = {};

  if (
    store.organizationSettingsByCompany &&
    typeof store.organizationSettingsByCompany === "object" &&
    !Array.isArray(store.organizationSettingsByCompany)
  ) {
    for (const [companyId, settings] of Object.entries(store.organizationSettingsByCompany)) {
      nextSettingsByCompany[normalizeCompanyId(companyId)] = normalizeSettingsRecord(settings);
    }
  }

  if (
    store.organizationSettings &&
    typeof store.organizationSettings === "object" &&
    !Array.isArray(store.organizationSettings)
  ) {
    const legacyCompanyId = normalizeCompanyId(store.organizationSettings.companyId);
    nextSettingsByCompany[legacyCompanyId] = normalizeSettingsRecord(store.organizationSettings);
  }

  normalized.organizationSettingsByCompany = nextSettingsByCompany;
  delete normalized.organizationSettings;
  return normalized;
};

export const getOrganizationSettingsForCompany = (store, companyId) => {
  const normalizedCompanyId = normalizeCompanyId(companyId);
  return normalizeSettingsRecord(store.organizationSettingsByCompany?.[normalizedCompanyId]);
};

export const setOrganizationSettingsForCompany = (store, companyId, settings) => {
  const normalizedCompanyId = normalizeCompanyId(companyId);
  const nextSettings = normalizeSettingsRecord(settings);

  store.organizationSettingsByCompany = {
    ...(store.organizationSettingsByCompany && typeof store.organizationSettingsByCompany === "object"
      ? store.organizationSettingsByCompany
      : {}),
    [normalizedCompanyId]: nextSettings,
  };

  delete store.organizationSettings;
  return nextSettings;
};
