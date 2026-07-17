import { Check, Envelope, Plus, TrashBin } from "@gravity-ui/icons";
import {
  Button,
  Chip,
  Modal,
  Separator,
  Skeleton,
  Tooltip,
  toast,
} from "@heroui/react";
import { ItemCard, ItemCardGroup } from "@heroui-pro/react";
import { useQueryClient } from "@tanstack/react-query";
import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import type {
  ConnectEmailAccountDtoProvider,
  ListEmailAccountsResponseDtoAccountsItem as EmailAccount,
} from "#/generated/api";
import {
  getEmailAccountsControllerListQueryKey,
  useEmailAccountsControllerConnect,
  useEmailAccountsControllerDisconnect,
  useEmailAccountsControllerList,
} from "#/generated/api";
import { formatDate } from "#/lib/format";

const GoogleIcon = (props: ComponentProps<"svg">) => (
  <svg
    aria-label="Google"
    height="48"
    role="img"
    viewBox="0 0 48 48"
    width="48"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917"
      fill="#ffc107"
    />
    <path
      d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691"
      fill="#ff3d00"
    />
    <path
      d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.9 11.9 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44"
      fill="#4caf50"
    />
    <path
      d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917"
      fill="#1976d2"
    />
  </svg>
);

const MicrosoftIcon = (props: ComponentProps<"svg">) => (
  <svg
    aria-label="Microsoft"
    height="24"
    role="img"
    viewBox="0 0 24 24"
    width="24"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M1 1h10.4v10.4H1z" fill="#f25022" />
    <path d="M12.6 1H23v10.4H12.6z" fill="#7fba00" />
    <path d="M1 12.6h10.4V23H1z" fill="#00a4ef" />
    <path d="M12.6 12.6H23V23H12.6z" fill="#ffb900" />
  </svg>
);

interface Provider {
  id: ConnectEmailAccountDtoProvider;
  name: string;
  blurb: string;
  icon: ReactNode;
}

const PROVIDERS: Provider[] = [
  {
    id: "GOOGLE",
    name: "Gmail",
    blurb: "Google Workspace & Gmail",
    icon: <GoogleIcon className="size-6" />,
  },
  {
    id: "OUTLOOK",
    name: "Outlook",
    blurb: "Microsoft 365 & Outlook",
    icon: <MicrosoftIcon className="size-5" />,
  },
  {
    id: "MAIL",
    name: "IMAP",
    blurb: "Any other mail server",
    icon: <Envelope className="size-5" />,
  },
];

function providerIcon(provider: string | null) {
  return (
    PROVIDERS.find((entry) => entry.id === provider)?.icon ?? (
      <Envelope className="size-5" />
    )
  );
}

/**
 * The Integrations settings tab: connect Gmail / Outlook / IMAP inboxes.
 * Every email that lands on a connected inbox with shipment documents
 * attached becomes (or joins) a shipment automatically.
 */
export function EmailIntegrations() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useEmailAccountsControllerList({
    query: { refetchInterval: 10_000 },
  });
  const connect = useEmailAccountsControllerConnect();
  const disconnect = useEmailAccountsControllerDisconnect();

  // Rows stuck in "pending" are abandoned connect attempts — not shown.
  const accounts = (data?.data.accounts ?? []).filter(
    (account) => account.status !== "pending",
  );

  const [connecting, setConnecting] =
    useState<ConnectEmailAccountDtoProvider | null>(null);
  const [pendingDisconnect, setPendingDisconnect] =
    useState<EmailAccount | null>(null);

  const handleConnect = async (provider: ConnectEmailAccountDtoProvider) => {
    setConnecting(provider);
    try {
      const response = await connect.mutateAsync({
        data: {
          provider,
          returnUrl: `${window.location.origin}/dashboard/settings`,
        },
      });
      // Same-window round trip — the hosted page redirects back here.
      window.location.assign(response.data.url);
    } catch {
      toast.danger("Could not start the connection flow");
      setConnecting(null);
    }
  };

  const confirmDisconnect = () => {
    if (!pendingDisconnect) return;
    const run = disconnect
      .mutateAsync({ id: pendingDisconnect.id })
      .then(async () => {
        await queryClient.invalidateQueries({
          queryKey: getEmailAccountsControllerListQueryKey(),
        });
        setPendingDisconnect(null);
      });
    toast.promise(run, {
      error: "Failed to disconnect inbox",
      loading: "Disconnecting...",
      success: "Inbox disconnected",
    });
  };

  const accountsFor = (provider: ConnectEmailAccountDtoProvider) =>
    accounts.filter((account) => account.provider === provider);

  return (
    <div className="flex flex-col gap-6">
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {PROVIDERS.map((provider) => (
            <Skeleton className="h-20 rounded-xl" key={provider.id} />
          ))}
        </div>
      ) : (
        <ItemCardGroup columns={3} layout="grid">
          {PROVIDERS.map((provider) => {
            const connected = accountsFor(provider.id);
            return (
              <ItemCard key={provider.id}>
                <ItemCard.Icon className="bg-default text-foreground">
                  {provider.icon}
                </ItemCard.Icon>
                <ItemCard.Content>
                  <ItemCard.Title>{provider.name}</ItemCard.Title>
                  <ItemCard.Description>
                    {connected.length === 0
                      ? provider.blurb
                      : connected.length === 1
                        ? (connected[0]?.emailAddress ?? "1 inbox connected")
                        : `${connected.length} inboxes connected`}
                  </ItemCard.Description>
                </ItemCard.Content>
                <ItemCard.Action>
                  <div className="flex items-center gap-2">
                    {connected.length > 0 ? (
                      <Check className="text-success size-5" />
                    ) : null}
                    <Tooltip delay={0}>
                      <Tooltip.Trigger>
                        <Button
                          isIconOnly
                          aria-label={`Connect ${provider.name}`}
                          isPending={connecting === provider.id}
                          size="sm"
                          variant="secondary"
                          onPress={() => void handleConnect(provider.id)}
                        >
                          <Plus className="size-4" />
                        </Button>
                      </Tooltip.Trigger>
                      <Tooltip.Content>Connect {provider.name}</Tooltip.Content>
                    </Tooltip>
                  </div>
                </ItemCard.Action>
              </ItemCard>
            );
          })}
        </ItemCardGroup>
      )}

      {accounts.length > 0 ? (
        <>
          <Separator />
          <div className="flex flex-col gap-3">
            <h3 className="text-foreground text-sm font-medium">
              Connected inboxes
            </h3>
            <ItemCardGroup variant="outline">
              {accounts.map((account) => (
                <ItemCard key={account.id}>
                  <ItemCard.Icon className="bg-default text-foreground">
                    {providerIcon(account.provider)}
                  </ItemCard.Icon>
                  <ItemCard.Content>
                    <ItemCard.Title>
                      {account.emailAddress ?? account.provider ?? "Inbox"}
                    </ItemCard.Title>
                    <ItemCard.Description>
                      {account.lastWebhookAt
                        ? `Last mail ${formatDate(account.lastWebhookAt)}`
                        : `Connected ${formatDate(account.createdAt)}`}
                    </ItemCard.Description>
                  </ItemCard.Content>
                  <ItemCard.Action>
                    <div className="flex items-center gap-2">
                      <Chip
                        color={
                          account.status === "connected" ? "success" : "danger"
                        }
                        size="sm"
                        variant="soft"
                      >
                        <Chip.Label>{account.status}</Chip.Label>
                      </Chip>
                      <Button
                        isIconOnly
                        aria-label="Disconnect inbox"
                        size="sm"
                        variant="ghost"
                        onPress={() => setPendingDisconnect(account)}
                      >
                        <TrashBin className="text-muted size-4" />
                      </Button>
                    </div>
                  </ItemCard.Action>
                </ItemCard>
              ))}
            </ItemCardGroup>
          </div>
        </>
      ) : null}

      <Modal
        isOpen={pendingDisconnect !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDisconnect(null);
        }}
      >
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-[360px]">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Icon className="bg-danger-soft text-danger-soft-foreground">
                  <TrashBin className="size-5" />
                </Modal.Icon>
                <Modal.Heading>
                  Disconnect {pendingDisconnect?.emailAddress ?? "this inbox"}?
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p>
                  New emails to this inbox will no longer create or update
                  shipments. Shipments already created from it are unaffected.
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  Cancel
                </Button>
                <Button
                  isPending={disconnect.isPending}
                  variant="danger"
                  onPress={confirmDisconnect}
                >
                  Disconnect
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
