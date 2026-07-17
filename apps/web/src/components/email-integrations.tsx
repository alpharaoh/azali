import { ChevronRight, Envelope, Plus, TrashBin } from "@gravity-ui/icons";
import { Button, Chip, Modal, Skeleton, Tooltip, toast } from "@heroui/react";
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

/** Pulsating "live" dot — shown wherever an inbox is actively connected. */
function LiveDot() {
  return (
    <span aria-label="Connected" className="relative flex size-2" role="img">
      <span className="bg-success absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
      <span className="bg-success relative inline-flex size-2 rounded-full" />
    </span>
  );
}

/**
 * The Integrations settings section: connect Gmail / Outlook / IMAP inboxes.
 * Each provider card shows a live indicator when at least one inbox is
 * connected; its chevron opens a modal listing every connected inbox with
 * disconnect controls and a button to connect another.
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
  const [openProviderId, setOpenProviderId] =
    useState<ConnectEmailAccountDtoProvider | null>(null);
  /** Account whose disconnect is awaiting inline confirmation. */
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const openProvider =
    PROVIDERS.find((provider) => provider.id === openProviderId) ?? null;

  const accountsFor = (provider: ConnectEmailAccountDtoProvider) =>
    accounts.filter((account) => account.provider === provider);

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

  const handleDisconnect = (account: EmailAccount) => {
    const run = disconnect.mutateAsync({ id: account.id }).then(async () => {
      await queryClient.invalidateQueries({
        queryKey: getEmailAccountsControllerListQueryKey(),
      });
      setConfirmingId(null);
    });
    toast.promise(run, {
      error: "Failed to disconnect inbox",
      loading: "Disconnecting...",
      success: "Inbox disconnected",
    });
  };

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
                  <ItemCard.Title>
                    <span className="flex items-center gap-2">
                      {provider.name}
                      {connected.length > 0 ? <LiveDot /> : null}
                    </span>
                  </ItemCard.Title>
                  <ItemCard.Description>
                    {connected.length === 0
                      ? provider.blurb
                      : connected.length === 1
                        ? (connected[0]?.emailAddress ?? "1 inbox connected")
                        : `${connected.length} inboxes connected`}
                  </ItemCard.Description>
                </ItemCard.Content>
                <ItemCard.Action>
                  {connected.length > 0 ? (
                    <Button
                      isIconOnly
                      aria-label={`Manage ${provider.name} inboxes`}
                      size="sm"
                      variant="ghost"
                      onPress={() => setOpenProviderId(provider.id)}
                    >
                      <ChevronRight className="text-muted size-4" />
                    </Button>
                  ) : (
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
                  )}
                </ItemCard.Action>
              </ItemCard>
            );
          })}
        </ItemCardGroup>
      )}

      <Modal
        isOpen={openProvider !== null}
        onOpenChange={(open) => {
          if (!open) {
            setOpenProviderId(null);
            setConfirmingId(null);
          }
        }}
      >
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-[440px]">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Icon className="bg-default text-foreground">
                  {openProvider?.icon}
                </Modal.Icon>
                <Modal.Heading>{openProvider?.name} inboxes</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                {openProvider && (
                  <ProviderAccountList
                    accounts={accountsFor(openProvider.id)}
                    confirmingId={confirmingId}
                    isDisconnecting={disconnect.isPending}
                    providerName={openProvider.name}
                    onCancelConfirm={() => setConfirmingId(null)}
                    onDisconnect={handleDisconnect}
                    onRequestConfirm={(id) => setConfirmingId(id)}
                  />
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  Close
                </Button>
                {openProvider && (
                  <Button
                    isPending={connecting === openProvider.id}
                    variant="primary"
                    onPress={() => void handleConnect(openProvider.id)}
                  >
                    <Plus className="size-4" />
                    Connect {openProvider.name}
                  </Button>
                )}
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

function ProviderAccountList({
  accounts,
  confirmingId,
  isDisconnecting,
  providerName,
  onCancelConfirm,
  onDisconnect,
  onRequestConfirm,
}: {
  accounts: EmailAccount[];
  confirmingId: string | null;
  isDisconnecting: boolean;
  providerName: string;
  onCancelConfirm: () => void;
  onDisconnect: (account: EmailAccount) => void;
  onRequestConfirm: (id: string) => void;
}) {
  if (accounts.length === 0) {
    return (
      <p className="text-muted py-6 text-center text-sm">
        No {providerName} inboxes connected yet.
      </p>
    );
  }

  return (
    <ul className="divide-border flex flex-col divide-y">
      {accounts.map((account) => {
        const confirming = confirmingId === account.id;
        return (
          <li className="flex items-center gap-3 py-3" key={account.id}>
            {account.status === "connected" ? (
              <LiveDot />
            ) : (
              <span className="bg-danger size-2 shrink-0 rounded-full" />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-foreground truncate text-sm">
                {account.emailAddress ?? "Inbox"}
              </span>
              <span className="text-muted text-xs">
                {confirming
                  ? "New emails will stop creating shipments."
                  : account.lastWebhookAt
                    ? `Last mail ${formatDate(account.lastWebhookAt)}`
                    : `Connected ${formatDate(account.createdAt)}`}
              </span>
            </div>
            {confirming ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <Button size="sm" variant="ghost" onPress={onCancelConfirm}>
                  Cancel
                </Button>
                <Button
                  isPending={isDisconnecting}
                  size="sm"
                  variant="danger"
                  onPress={() => onDisconnect(account)}
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-2">
                {account.status !== "connected" ? (
                  <Chip color="danger" size="sm" variant="soft">
                    <Chip.Label>{account.status}</Chip.Label>
                  </Chip>
                ) : null}
                <Button
                  isIconOnly
                  aria-label={`Disconnect ${account.emailAddress ?? "inbox"}`}
                  size="sm"
                  variant="ghost"
                  onPress={() => onRequestConfirm(account.id)}
                >
                  <TrashBin className="text-muted size-4" />
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
