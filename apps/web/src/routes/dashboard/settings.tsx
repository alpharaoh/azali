import {
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  Separator,
  TextArea,
  TextField,
  toast,
} from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { EmailIntegrations } from "#/components/email-integrations";
import type { OrganizationResponseDto } from "#/generated/api";
import {
  getOrganizationControllerGetCurrentQueryKey,
  getOrganizationControllerGetCurrentQueryOptions,
  useOrganizationControllerGetCurrent,
  useOrganizationControllerUpdate,
} from "#/generated/api";

// Optional so plain links to /dashboard/settings need no search params.
const settingsSearchSchema = z.object({
  /** Result flag appended by the hosted inbox-connection flow's redirect. */
  connected: z.enum(["success", "error"]).optional().catch(undefined),
});

export const Route = createFileRoute("/dashboard/settings")({
  validateSearch: (search) => settingsSearchSchema.parse(search),
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData(
      getOrganizationControllerGetCurrentQueryOptions(),
    );
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { connected } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data } = useOrganizationControllerGetCurrent();
  const organization = data?.data;

  // One-shot toast when the hosted connection flow redirects back.
  useEffect(() => {
    if (!connected) return;
    if (connected === "success") toast.success("Inbox connected");
    else toast.danger("Inbox connection failed — please try again");
    void navigate({
      replace: true,
      search: (previous) => ({ ...previous, connected: undefined }),
    });
  }, [connected, navigate]);

  return (
    <div className="p-4 pt-0">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-foreground text-base font-medium">
              Integrations
            </h2>
            <p className="text-muted text-xs leading-snug">
              Connect the inboxes where shipment paperwork arrives. Emails with
              documents attached become shipments automatically; related emails
              for the same invoice are grouped for a while before classification
              starts.
            </p>
          </div>
          <Separator />
          <EmailIntegrations />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-foreground text-base font-medium">
            Organization
          </h2>
          {organization && (
            <OrganizationForm
              key={`${organization.id}-${organization.name}`}
              organization={organization}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function OrganizationForm({
  organization,
}: {
  organization: OrganizationResponseDto;
}) {
  const queryClient = useQueryClient();
  const updateOrganization = useOrganizationControllerUpdate();

  const [name, setName] = useState(organization.name);
  const [description, setDescription] = useState(
    organization.description ?? "",
  );
  const [website, setWebsite] = useState(organization.website ?? "");
  const [contactEmail, setContactEmail] = useState(
    organization.contactEmail ?? "",
  );
  const [filerCode, setFilerCode] = useState(organization.filerCode ?? "");
  const [emailIntakeWindow, setEmailIntakeWindow] = useState(
    organization.emailIntakeWindowMinutes?.toString() ?? "",
  );

  const reset = () => {
    setName(organization.name);
    setDescription(organization.description ?? "");
    setWebsite(organization.website ?? "");
    setContactEmail(organization.contactEmail ?? "");
    setFilerCode(organization.filerCode ?? "");
    setEmailIntakeWindow(
      organization.emailIntakeWindowMinutes?.toString() ?? "",
    );
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const run = updateOrganization
      .mutateAsync({
        data: {
          name: name.trim(),
          description: description.trim() || null,
          website: website.trim() || null,
          contactEmail: contactEmail.trim() || null,
          filerCode: filerCode.trim() || null,
          emailIntakeWindowMinutes: emailIntakeWindow.trim()
            ? Number(emailIntakeWindow.trim())
            : null,
        },
      })
      .then(async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: getOrganizationControllerGetCurrentQueryKey(),
          }),
          queryClient.invalidateQueries({ queryKey: ["/v1/users/me"] }),
        ]);
      });

    toast.promise(run, {
      error: "Failed to save organization settings",
      loading: "Saving...",
      success: "Organization settings saved",
    });
  };

  return (
    <Form className="flex w-full flex-col gap-4 pb-10" onSubmit={handleSubmit}>
      <Separator />

      <SettingsRow
        description="Your brokerage's display name, shown across the workspace."
        label="Organization Name"
      >
        <TextField
          fullWidth
          isRequired
          name="name"
          value={name}
          onChange={setName}
        >
          <Label className="sr-only">Organization Name</Label>
          <Input placeholder="Your organization" />
          <FieldError />
        </TextField>
      </SettingsRow>

      <Separator />

      <SettingsRow
        description="A short description of your brokerage. Maximum 240 characters."
        label="Description"
      >
        <TextField
          fullWidth
          name="description"
          value={description}
          onChange={setDescription}
        >
          <Label className="sr-only">Description</Label>
          <TextArea
            className="min-h-24 resize-y"
            maxLength={240}
            placeholder="Licensed customs brokerage specializing in..."
          />
        </TextField>
      </SettingsRow>

      <Separator />

      <SettingsRow
        description="Your company website, shown to clients."
        label="Website"
      >
        <TextField
          fullWidth
          name="website"
          value={website}
          onChange={setWebsite}
        >
          <Label className="sr-only">Website</Label>
          <Input inputMode="url" placeholder="https://example.com" />
        </TextField>
      </SettingsRow>

      <Separator />

      <SettingsRow
        description="How clients and CBP reach your brokerage."
        label="Contact Email"
      >
        <TextField
          fullWidth
          name="contactEmail"
          type="email"
          value={contactEmail}
          onChange={setContactEmail}
        >
          <Label className="sr-only">Contact Email</Label>
          <Input placeholder="operations@example.com" />
          <FieldError />
        </TextField>
      </SettingsRow>

      <Separator />

      <SettingsRow
        description="Your CBP broker filer code — 3 characters, printed on entries and ruling requests."
        label="CBP Filer Code"
      >
        <TextField
          fullWidth
          name="filerCode"
          validate={(value) =>
            value && !/^[A-Za-z0-9]{3}$/.test(value)
              ? "Filer code is exactly 3 letters or digits"
              : null
          }
          value={filerCode}
          onChange={(value) => setFilerCode(value.toUpperCase())}
        >
          <Label className="sr-only">CBP Filer Code</Label>
          <Input
            className="max-w-32 font-mono uppercase"
            maxLength={3}
            placeholder="ABC"
          />
          <Description>
            Assigned by CBP when your brokerage license was issued.
          </Description>
          <FieldError />
        </TextField>
      </SettingsRow>

      <Separator />

      <SettingsRow
        description="How long a shipment created from a connected inbox collects follow-up emails before classification starts."
        label="Email Intake Window"
      >
        <TextField
          fullWidth
          name="emailIntakeWindow"
          validate={(value) => {
            if (!value) return null;
            const minutes = Number(value);
            return Number.isInteger(minutes) && minutes >= 1 && minutes <= 10080
              ? null
              : "Enter whole minutes between 1 and 10,080 (one week)";
          }}
          value={emailIntakeWindow}
          onChange={setEmailIntakeWindow}
        >
          <Label className="sr-only">Email Intake Window</Label>
          <Input className="max-w-32" inputMode="numeric" placeholder="120" />
          <Description>
            Minutes. Leave empty for the default of 120 minutes.
          </Description>
          <FieldError />
        </TextField>
      </SettingsRow>

      <Separator />

      <footer className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onPress={reset}>
          Reset
        </Button>
        <Button
          isPending={updateOrganization.isPending}
          type="submit"
          variant="primary"
        >
          Save changes
        </Button>
      </footer>
    </Form>
  );
}

interface SettingsRowProps {
  description: string;
  label: string;
  children: ReactNode;
}

function SettingsRow({ children, description, label }: SettingsRowProps) {
  return (
    <div className="grid grid-cols-1 gap-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] md:gap-10">
      <div className="flex flex-col gap-1">
        <span className="text-foreground text-sm font-medium">{label}</span>
        <p className="text-muted text-xs leading-snug">{description}</p>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
