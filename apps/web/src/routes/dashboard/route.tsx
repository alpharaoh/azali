import {
  ArrowRightFromSquare,
  Book,
  CircleDollar,
  Gear,
  ListCheck,
  Persons,
  Pipeline,
  Pulse,
  Sparkles,
} from "@gravity-ui/icons";
import {
  Avatar,
  Breadcrumbs,
  Dropdown,
  dropdownVariants,
  Label,
} from "@heroui/react";
import { menuItemVariants } from "@heroui/styles";
import { AppLayout, cn, Sidebar } from "@heroui-pro/react";
import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import type { ComponentType, SVGProps } from "react";
import { Fragment, useEffect, useState } from "react";

import { ThemeSwitcher } from "#/components/theme-switcher";
import { usePendingReviewCount } from "#/data/review-queue";
import {
  getUsersControllerGetProfileQueryOptions,
  useUsersControllerGetProfile,
} from "#/generated/api";
import { sessionQueryOptions, signOutAndRedirect } from "#/lib/auth";
import { toggleTheme } from "#/lib/theme";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions,
    );
    if (!session) {
      throw redirect({ to: "/login" });
    }
  },
  loader: ({ context }) => {
    // Warm the navbar profile query; don't block navigation on it.
    void context.queryClient.prefetchQuery(
      getUsersControllerGetProfileQueryOptions(),
    );
  },
  component: DashboardLayout,
});

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  chip?: string;
};

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Operations",
    items: [
      {
        id: "review",
        label: "Review Queue",
        href: "/dashboard/review",
        icon: ListCheck,
      },
      {
        id: "pipeline",
        label: "Pipeline",
        href: "/dashboard/pipeline",
        icon: Pipeline,
      },
      {
        id: "autopilot",
        label: "Autopilot Log",
        href: "/dashboard/autopilot",
        icon: Sparkles,
      },
    ],
  },
  {
    label: "Knowledge",
    items: [
      {
        id: "classifications",
        label: "Classification Engine",
        href: "/dashboard/classifications",
        icon: Book,
      },
      {
        id: "tariff-radar",
        label: "Tariff Radar",
        href: "/dashboard/tariff-radar",
        icon: Pulse,
        chip: "3",
      },
    ],
  },
  {
    label: "Revenue",
    items: [
      {
        id: "recoveries",
        label: "Recoveries",
        href: "/dashboard/recoveries",
        icon: CircleDollar,
      },
      {
        id: "clients",
        label: "Clients",
        href: "/dashboard/clients",
        icon: Persons,
      },
    ],
  },
];

const FOOTER_ITEMS: NavItem[] = [
  {
    id: "settings",
    label: "Settings",
    href: "/dashboard/settings",
    icon: Gear,
  },
];

const ALL_ITEMS = [
  ...NAV_GROUPS.flatMap((group) => group.items),
  ...FOOTER_ITEMS,
];

const SidebarBrand = () => (
  <div className="flex items-center gap-3 px-1 py-2">
    <div className="bg-accent flex size-8 shrink-0 items-center justify-center rounded-lg">
      <span className="text-background text-sm font-bold">A</span>
    </div>
    <div className="flex flex-col">
      <span className="text-foreground text-sm font-semibold leading-tight">
        Azali
      </span>
      <span className="text-muted text-xs leading-tight">
        AI Customs Brokerage
      </span>
    </div>
  </div>
);

const ReviewCountChip = () => {
  const count = usePendingReviewCount();

  if (count === 0) return null;

  return <Sidebar.MenuChip>{count}</Sidebar.MenuChip>;
};

const SidebarNav = ({
  idSuffix = "",
  pathname,
}: {
  idSuffix?: string;
  pathname: string;
}) => (
  <>
    {NAV_GROUPS.map((group, index) => (
      <Fragment key={group.label}>
        {index > 0 ? <Sidebar.Separator /> : null}
        <Sidebar.Group>
          <Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>
          <Sidebar.Menu aria-label={group.label}>
            {group.items.map((item) => (
              <Sidebar.MenuItem
                key={item.id}
                href={item.href}
                id={`${item.id}${idSuffix}`}
                isCurrent={pathname.startsWith(item.href)}
                textValue={item.label}
              >
                <Sidebar.MenuIcon>
                  <item.icon className="size-4" />
                </Sidebar.MenuIcon>
                <Sidebar.MenuLabel>{item.label}</Sidebar.MenuLabel>
                {item.id === "review" ? (
                  <ReviewCountChip />
                ) : item.chip ? (
                  <Sidebar.MenuChip>{item.chip}</Sidebar.MenuChip>
                ) : null}
              </Sidebar.MenuItem>
            ))}
          </Sidebar.Menu>
        </Sidebar.Group>
      </Fragment>
    ))}
  </>
);

const SidebarBase = ({
  idSuffix = "",
  pathname,
}: {
  idSuffix?: string;
  pathname: string;
}) => {
  const navigate = useNavigate();

  return (
    <Sidebar.Footer>
      <Sidebar.Menu aria-label="Workspace">
        {FOOTER_ITEMS.map((item) => (
          <Sidebar.MenuItem
            key={item.id}
            href={item.href}
            id={`${item.id}${idSuffix}`}
            isCurrent={pathname.startsWith(item.href)}
            textValue={item.label}
          >
            <Sidebar.MenuIcon>
              <item.icon className="size-4" />
            </Sidebar.MenuIcon>
            <Sidebar.MenuLabel>{item.label}</Sidebar.MenuLabel>
          </Sidebar.MenuItem>
        ))}
        <Sidebar.MenuItem
          id={`sign-out${idSuffix}`}
          textValue="Sign out"
          onAction={() => {
            signOutAndRedirect(() => navigate({ to: "/login" }));
          }}
        >
          <Sidebar.MenuIcon>
            <ArrowRightFromSquare className="size-4" />
          </Sidebar.MenuIcon>
          <Sidebar.MenuLabel>Sign out</Sidebar.MenuLabel>
        </Sidebar.MenuItem>
      </Sidebar.Menu>
    </Sidebar.Footer>
  );
};

const DashboardSidebar = ({ pathname }: { pathname: string }) => (
  <>
    <Sidebar>
      <Sidebar.Header>
        <SidebarBrand />
      </Sidebar.Header>
      <Sidebar.Content>
        <SidebarNav pathname={pathname} />
      </Sidebar.Content>
      <SidebarBase pathname={pathname} />
    </Sidebar>
    <Sidebar.Mobile>
      <Sidebar.Header>
        <SidebarBrand />
      </Sidebar.Header>
      <Sidebar.Content>
        <SidebarNav idSuffix="-mobile" pathname={pathname} />
      </Sidebar.Content>
      <SidebarBase idSuffix="-mobile" pathname={pathname} />
    </Sidebar.Mobile>
  </>
);

const DashboardNavbar = ({ sectionLabel }: { sectionLabel: string }) => {
  const navigate = useNavigate();
  const { data: me } = useUsersControllerGetProfile();
  const user = me?.data.user;
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const main = document.querySelector("[data-slot='app-layout-main']");
    const update = () => {
      setIsScrolled(window.scrollY > 0 || (main?.scrollTop ?? 0) > 0);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    main?.addEventListener("scroll", update, { passive: true });

    return () => {
      window.removeEventListener("scroll", update);
      main?.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div
      className={`bg-white dark:bg-[#121212] flex items-center gap-3 border-b p-4 transition-colors duration-200 ${
        isScrolled ? "border-border" : "border-transparent"
      }`}
    >
      <Sidebar.Trigger />
      <Breadcrumbs className="min-w-0">
        <Breadcrumbs.Item className="text-muted min-w-0" href="/dashboard">
          Azali
        </Breadcrumbs.Item>
        <Breadcrumbs.Item className="min-w-0 font-semibold">
          <span className="truncate">{sectionLabel}</span>
        </Breadcrumbs.Item>
      </Breadcrumbs>
      <Dropdown>
        <Dropdown.Trigger className="ml-auto shrink-0 rounded-full">
          <Avatar size="sm">
            {user?.image && (
              <Avatar.Image alt={user.name ?? ""} src={user.image} />
            )}
            <Avatar.Fallback className="text-xs" delayMs={600}>
              {getInitials(user?.name || user?.email)}
            </Avatar.Fallback>
          </Avatar>
        </Dropdown.Trigger>
        <Dropdown.Popover>
          <div className="px-3 pt-3 pb-1">
            <div className="flex items-center gap-2">
              <Avatar size="sm">
                {user?.image && (
                  <Avatar.Image alt={user.name ?? ""} src={user.image} />
                )}
                <Avatar.Fallback className="text-xs" delayMs={600}>
                  {getInitials(user?.name || user?.email)}
                </Avatar.Fallback>
              </Avatar>
              <div className="flex flex-col gap-0">
                <p className="text-sm leading-5 font-medium">{user?.name}</p>
                <p className="text-muted text-xs leading-none">{user?.email}</p>
              </div>
            </div>
          </div>
          <Dropdown.Menu
            aria-label="Account"
            onAction={(key) => {
              if (key === "settings") {
                navigate({ to: "/dashboard/settings" });
              }
            }}
          >
            <Dropdown.Item id="settings" textValue="Settings">
              <div className="flex w-full items-center justify-between gap-2">
                <Label>Settings</Label>
                <Gear className="text-muted size-3.5" />
              </div>
            </Dropdown.Item>
          </Dropdown.Menu>
          <div className={cn(dropdownVariants({}).menu())}>
            <button
              className={cn(
                menuItemVariants({}).item(),
                "group w-full cursor-pointer",
              )}
              data-slot="menu-item"
              onClick={toggleTheme}
              type="button"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <Label>Theme</Label>
                <ThemeSwitcher readOnly />
              </div>
            </button>
          </div>
          <Dropdown.Menu
            aria-label="Session"
            onAction={(key) => {
              if (key === "logout") {
                signOutAndRedirect(() => navigate({ to: "/login" }));
              }
            }}
          >
            <Dropdown.Item id="logout" textValue="Logout" variant="danger">
              <div className="flex w-full items-center justify-between gap-2">
                <Label>Log Out</Label>
                <ArrowRightFromSquare className="text-danger size-3.5" />
              </div>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
};

function DashboardLayout() {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const activeItem = ALL_ITEMS.find((item) => pathname.startsWith(item.href));

  return (
    <AppLayout
      navbar={
        <DashboardNavbar sectionLabel={activeItem?.label ?? "Dashboard"} />
      }
      navigate={(href) => navigate({ to: href })}
      sidebar={<DashboardSidebar pathname={pathname} />}
      sidebarCollapsible="offcanvas"
      sidebarVariant="inset"
    >
      <Outlet />
    </AppLayout>
  );
}

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
