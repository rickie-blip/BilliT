import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSettings, saveSettings } from '@/lib/api';
import type { OrganizationSettings } from '@/types/domain';

const defaultSettings = (): OrganizationSettings => ({
  companyName: '',
  tradingName: '',
  registrationNumber: '',
  taxPin: '',
  supportEmail: '',
  supportPhone: '',
  address: '',
  website: '',
  invoicePrefix: 'INV',
  billingCycleDay: 1,
  gracePeriodDays: 7,
  currency: 'KES',
  timezone: 'Africa/Nairobi',
  mpesaConsumerKey: '',
  mpesaConsumerSecret: '',
  mpesaShortcode: '',
  mpesaPasskey: '',
  mpesaCallbackUrl: '',
  smsProvider: '',
  smsSenderId: '',
  emailHost: '',
  emailPort: 587,
  emailUser: '',
  emailFrom: '',
  radiusServer: '',
  radiusSecret: '',
  primaryRouter: '',
  notes: '',
});

type SettingsFormState = {
  [K in keyof OrganizationSettings]: string;
};

const toFormState = (settings: OrganizationSettings): SettingsFormState => ({
  companyName: settings.companyName || '',
  tradingName: settings.tradingName || '',
  registrationNumber: settings.registrationNumber || '',
  taxPin: settings.taxPin || '',
  supportEmail: settings.supportEmail || '',
  supportPhone: settings.supportPhone || '',
  address: settings.address || '',
  website: settings.website || '',
  invoicePrefix: settings.invoicePrefix || 'INV',
  billingCycleDay: String(settings.billingCycleDay ?? 1),
  gracePeriodDays: String(settings.gracePeriodDays ?? 7),
  currency: settings.currency || 'KES',
  timezone: settings.timezone || 'Africa/Nairobi',
  mpesaConsumerKey: settings.mpesaConsumerKey || '',
  mpesaConsumerSecret: settings.mpesaConsumerSecret || '',
  mpesaShortcode: settings.mpesaShortcode || '',
  mpesaPasskey: settings.mpesaPasskey || '',
  mpesaCallbackUrl: settings.mpesaCallbackUrl || '',
  smsProvider: settings.smsProvider || '',
  smsSenderId: settings.smsSenderId || '',
  emailHost: settings.emailHost || '',
  emailPort: String(settings.emailPort ?? 587),
  emailUser: settings.emailUser || '',
  emailFrom: settings.emailFrom || '',
  radiusServer: settings.radiusServer || '',
  radiusSecret: settings.radiusSecret || '',
  primaryRouter: settings.primaryRouter || '',
  notes: settings.notes || '',
});

const toPayload = (form: SettingsFormState): OrganizationSettings => ({
  companyName: form.companyName.trim(),
  tradingName: form.tradingName.trim(),
  registrationNumber: form.registrationNumber.trim(),
  taxPin: form.taxPin.trim(),
  supportEmail: form.supportEmail.trim(),
  supportPhone: form.supportPhone.trim(),
  address: form.address.trim(),
  website: form.website.trim(),
  invoicePrefix: form.invoicePrefix.trim() || 'INV',
  billingCycleDay: Number(form.billingCycleDay) || 1,
  gracePeriodDays: Number(form.gracePeriodDays) || 7,
  currency: form.currency.trim() || 'KES',
  timezone: form.timezone.trim() || 'Africa/Nairobi',
  mpesaConsumerKey: form.mpesaConsumerKey.trim(),
  mpesaConsumerSecret: form.mpesaConsumerSecret.trim(),
  mpesaShortcode: form.mpesaShortcode.trim(),
  mpesaPasskey: form.mpesaPasskey.trim(),
  mpesaCallbackUrl: form.mpesaCallbackUrl.trim(),
  smsProvider: form.smsProvider.trim(),
  smsSenderId: form.smsSenderId.trim(),
  emailHost: form.emailHost.trim(),
  emailPort: Number(form.emailPort) || 587,
  emailUser: form.emailUser.trim(),
  emailFrom: form.emailFrom.trim(),
  radiusServer: form.radiusServer.trim(),
  radiusSecret: form.radiusSecret.trim(),
  primaryRouter: form.primaryRouter.trim(),
  notes: form.notes.trim(),
});

const SectionCard = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) => (
  <section className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
    <div>
      <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
    {children}
  </section>
);

const Field = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  password = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  password?: boolean;
}) => (
  <div>
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    <input
      type={password ? 'password' : type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
    />
  </div>
);

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SettingsFormState>(() => toFormState(defaultSettings()));

  const { data: settings, isPending, isError, error } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  useEffect(() => {
    if (settings) {
      setForm(toFormState(settings));
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: async (saved) => {
      setForm(toFormState(saved));
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  if (isPending) {
    return <div className="p-8 text-sm text-muted-foreground">Loading settings...</div>;
  }

  if (isError) {
    return (
      <div className="p-8 text-sm text-destructive">
        Failed to load settings: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  const update = <K extends keyof SettingsFormState>(key: K, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Company Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Store the business, billing, and payment details each ISP needs for its own operation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => settings && setForm(toFormState(settings))}
            className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"
          >
            Reset
          </button>
          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate(toPayload(form))}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <SectionCard
        title="Business Profile"
        description="Basic company identity and contact details used across invoices and statements."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Company Name" value={form.companyName} onChange={(value) => update('companyName', value)} />
          <Field label="Trading Name" value={form.tradingName} onChange={(value) => update('tradingName', value)} />
          <Field label="Registration Number" value={form.registrationNumber} onChange={(value) => update('registrationNumber', value)} />
          <Field label="Tax PIN" value={form.taxPin} onChange={(value) => update('taxPin', value)} />
          <Field label="Support Email" value={form.supportEmail} onChange={(value) => update('supportEmail', value)} type="email" />
          <Field label="Support Phone" value={form.supportPhone} onChange={(value) => update('supportPhone', value)} />
          <Field label="Website" value={form.website} onChange={(value) => update('website', value)} placeholder="https://..." />
          <Field label="Business Address" value={form.address} onChange={(value) => update('address', value)} />
        </div>
      </SectionCard>

      <SectionCard
        title="Billing Rules"
        description="Defaults for invoice numbering, billing cadence, and customer grace periods."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <Field label="Invoice Prefix" value={form.invoicePrefix} onChange={(value) => update('invoicePrefix', value)} />
          <Field label="Billing Cycle Day" value={form.billingCycleDay} onChange={(value) => update('billingCycleDay', value)} type="number" />
          <Field label="Grace Period Days" value={form.gracePeriodDays} onChange={(value) => update('gracePeriodDays', value)} type="number" />
          <Field label="Currency" value={form.currency} onChange={(value) => update('currency', value)} />
          <Field label="Timezone" value={form.timezone} onChange={(value) => update('timezone', value)} />
        </div>
      </SectionCard>

      <SectionCard
        title="M-Pesa Settings"
        description="Per-ISP Daraja credentials and callback details for STK Push payments."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Consumer Key" value={form.mpesaConsumerKey} onChange={(value) => update('mpesaConsumerKey', value)} password />
          <Field label="Consumer Secret" value={form.mpesaConsumerSecret} onChange={(value) => update('mpesaConsumerSecret', value)} password />
          <Field label="Shortcode / Paybill" value={form.mpesaShortcode} onChange={(value) => update('mpesaShortcode', value)} />
          <Field label="Passkey" value={form.mpesaPasskey} onChange={(value) => update('mpesaPasskey', value)} password />
          <Field label="Callback URL" value={form.mpesaCallbackUrl} onChange={(value) => update('mpesaCallbackUrl', value)} placeholder="https://.../api/mpesa/callback" />
        </div>
      </SectionCard>

      <SectionCard
        title="Notifications"
        description="Settings for SMS and email delivery when invoices or payments change."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="SMS Provider" value={form.smsProvider} onChange={(value) => update('smsProvider', value)} />
          <Field label="SMS Sender ID" value={form.smsSenderId} onChange={(value) => update('smsSenderId', value)} />
          <Field label="Email Host" value={form.emailHost} onChange={(value) => update('emailHost', value)} />
          <Field label="Email Port" value={form.emailPort} onChange={(value) => update('emailPort', value)} type="number" />
          <Field label="Email User" value={form.emailUser} onChange={(value) => update('emailUser', value)} />
          <Field label="Email From" value={form.emailFrom} onChange={(value) => update('emailFrom', value)} />
        </div>
      </SectionCard>

      <SectionCard
        title="Network Profile"
        description="Optional defaults for RADIUS and router-related operations."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="RADIUS Server" value={form.radiusServer} onChange={(value) => update('radiusServer', value)} />
          <Field label="RADIUS Secret" value={form.radiusSecret} onChange={(value) => update('radiusSecret', value)} password />
          <Field label="Primary Router" value={form.primaryRouter} onChange={(value) => update('primaryRouter', value)} />
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
              rows={4}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              placeholder="Internal notes for setup, contacts, or support procedures"
            />
          </div>
        </div>
      </SectionCard>

      {saveMutation.isError && (
        <p className="text-xs text-destructive">
          {saveMutation.error instanceof Error ? saveMutation.error.message : 'Failed to save settings'}
        </p>
      )}
    </div>
  );
}
