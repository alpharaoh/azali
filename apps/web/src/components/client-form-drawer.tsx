import { PersonMagnifier, Sparkles } from "@gravity-ui/icons";
import {
  Button,
  ComboBox,
  Description,
  Drawer,
  FieldError,
  Form,
  Header,
  Input,
  Label,
  ListBox,
  Tag,
  TagGroup,
  TextField,
  toast,
} from "@heroui/react";
import { RadioButtonGroup } from "@heroui-pro/react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Collection } from "react-aria-components";
import { PORT_GROUPS } from "#/data/ports";
import type {
  ListClientsResponseDtoDataItem as ApiClient,
  CreateClientDto,
} from "#/generated/api";
import {
  getClientsControllerFindAllQueryKey,
  useClientsControllerCreate,
  useClientsControllerUpdate,
} from "#/generated/api";
import { COUNTRY_ITEMS, countryName } from "#/lib/countries";
import { getCountryFlag } from "#/lib/country-flag";

/* -------------------------------------------------------------------------------------------------
 * Reference data
 * -----------------------------------------------------------------------------------------------*/

// CBP Centers of Excellence and Expertise — the standardized industry
// categories U.S. Customs uses to process entries.
const INDUSTRIES = [
  "Agriculture & Prepared Products",
  "Apparel, Footwear & Textiles",
  "Automotive & Aerospace",
  "Base Metals",
  "Consumer Products & Mass Merchandising",
  "Electronics",
  "Industrial & Manufacturing Materials",
  "Machinery",
  "Petroleum, Natural Gas & Minerals",
  "Pharmaceuticals, Health & Chemicals",
];

const AUTONOMY_OPTIONS = [
  {
    value: "supervised",
    label: "Supervised",
    description:
      "Every entry is queued for a licensed broker to review and approve before it is filed with CBP.",
    icon: PersonMagnifier,
    iconClassName: "bg-default text-muted",
  },
  {
    value: "autopilot",
    label: "Autopilot",
    description:
      "High-confidence entries are filed automatically; only exceptions are routed for human review.",
    icon: Sparkles,
    iconClassName: "bg-accent-soft text-accent-soft-foreground",
  },
] as const;

/* -------------------------------------------------------------------------------------------------
 * Drawer shell
 * -----------------------------------------------------------------------------------------------*/

interface ClientFormDrawerProps {
  client: ApiClient | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientFormDrawer({
  client,
  isOpen,
  onOpenChange,
}: ClientFormDrawerProps) {
  return (
    <Drawer isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="sm:max-w-140 w-full">
            {isOpen && (
              <ClientForm
                key={client?.id ?? "create"}
                client={client}
                onClose={() => onOpenChange(false)}
              />
            )}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Form (keyed by client so state resets between create/edit targets)
 * -----------------------------------------------------------------------------------------------*/

function ClientForm({
  client,
  onClose,
}: {
  client: ApiClient | null;
  onClose: () => void;
}) {
  const isEdit = client !== null;

  const [name, setName] = useState(client?.name ?? "");
  const [iorNumber, setIorNumber] = useState(client?.iorNumber ?? "");
  const [bondNumber, setBondNumber] = useState(client?.bondNumber ?? "");
  const [origin, setOrigin] = useState<string | null>(
    client?.primaryOrigin ?? null,
  );
  const [industry, setIndustry] = useState(client?.industry ?? "");
  const [autonomy, setAutonomy] = useState<string>(
    client?.autonomy ?? "supervised",
  );
  const [ports, setPorts] = useState<string[]>(client?.portsOfEntry ?? []);
  const [portInput, setPortInput] = useState("");

  const queryClient = useQueryClient();
  const createClient = useClientsControllerCreate();
  const updateClient = useClientsControllerUpdate();
  const isSaving = createClient.isPending || updateClient.isPending;

  const industryItems = useMemo(() => {
    const query = industry.trim().toLowerCase();
    const matches = INDUSTRIES.filter((entry) =>
      entry.toLowerCase().includes(query),
    );

    return (matches.length ? matches : INDUSTRIES).map((entry) => ({
      id: entry,
    }));
  }, [industry]);

  // Groups filtered by the typed query (matching port or country name) with
  // already-selected ports removed; empty groups drop out entirely.
  const portGroups = useMemo(() => {
    const query = portInput.trim().toLowerCase();

    return PORT_GROUPS.map((group) => {
      const country = countryName(group.code);
      const matchesCountry = country.toLowerCase().includes(query);

      return {
        id: group.code,
        country,
        ports: group.ports
          .filter(
            (port) =>
              !ports.includes(port) &&
              (matchesCountry || port.toLowerCase().includes(query)),
          )
          .map((port) => ({ id: port })),
      };
    }).filter((group) => group.ports.length > 0);
  }, [ports, portInput]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!origin) return;

    const dto: CreateClientDto = {
      name: name.trim(),
      iorNumber: iorNumber.trim(),
      bondNumber: bondNumber.trim(),
      primaryOrigin: origin,
      industry: industry.trim(),
      autonomy: autonomy as CreateClientDto["autonomy"],
      status: client?.status ?? "active",
      portsOfEntry: ports,
      image: client?.image ?? null,
    };

    const run = (
      isEdit
        ? updateClient.mutateAsync({ id: client.id, data: dto })
        : createClient.mutateAsync({ data: dto })
    ).then(async () => {
      await queryClient.invalidateQueries({
        queryKey: getClientsControllerFindAllQueryKey(),
      });
      onClose();

      return dto.name;
    });

    toast.promise(run, {
      error: isEdit ? "Failed to update client" : "Failed to create client",
      loading: isEdit ? "Updating client..." : "Creating client...",
      success: (clientName) =>
        isEdit ? `Updated ${clientName}` : `Created ${clientName}`,
    });
  };

  return (
    <Form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
      <Drawer.CloseTrigger />
      <Drawer.Header>
        <Drawer.Heading>
          {isEdit ? `Edit ${client.name}` : "Add Client"}
        </Drawer.Heading>
      </Drawer.Header>

      <Drawer.Body className="flex flex-col gap-5">
        <TextField
          fullWidth
          isRequired
          name="name"
          value={name}
          onChange={setName}
        >
          <Label>Client Name</Label>
          <Input placeholder="Acme Imports Inc." />
          <FieldError />
        </TextField>

        <TextField
          fullWidth
          isRequired
          name="iorNumber"
          value={iorNumber}
          onChange={setIorNumber}
        >
          <Label>IOR Number</Label>
          <Input placeholder="12-3456789" />
          <Description>
            Importer of record number assigned by CBP (usually EIN-based).
          </Description>
          <FieldError />
        </TextField>

        <TextField
          fullWidth
          isRequired
          name="bondNumber"
          value={bondNumber}
          onChange={setBondNumber}
        >
          <Label>Bond Number</Label>
          <Input placeholder="991234567" />
          <Description>Continuous customs bond number.</Description>
          <FieldError />
        </TextField>

        <ComboBox
          fullWidth
          isRequired
          defaultItems={COUNTRY_ITEMS}
          name="primaryOrigin"
          selectedKey={origin}
          onSelectionChange={(key) => setOrigin(key ? String(key) : null)}
        >
          <Label>Country of Origin</Label>
          <ComboBox.InputGroup>
            <Input placeholder="Search countries..." />
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          <FieldError />
          <ComboBox.Popover>
            <ListBox>
              {(item: (typeof COUNTRY_ITEMS)[number]) => {
                const Flag = getCountryFlag(item.code);

                return (
                  <ListBox.Item
                    key={item.code}
                    id={item.code}
                    textValue={item.name}
                  >
                    {Flag && <Flag className="h-3 w-4 shrink-0 rounded-xs" />}
                    {item.name}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                );
              }}
            </ListBox>
          </ComboBox.Popover>
        </ComboBox>

        <ComboBox
          allowsCustomValue
          fullWidth
          isRequired
          inputValue={industry}
          items={industryItems}
          name="industry"
          onInputChange={setIndustry}
          onSelectionChange={(key) => {
            if (key) setIndustry(String(key));
          }}
        >
          <Label>Industry</Label>
          <ComboBox.InputGroup>
            <Input placeholder="Select an industry..." />
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          <Description>
            CBP Center of Excellence & Expertise industry category.
          </Description>
          <FieldError />
          <ComboBox.Popover>
            <ListBox>
              {(item: { id: string }) => (
                <ListBox.Item key={item.id} id={item.id} textValue={item.id}>
                  {item.id}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              )}
            </ListBox>
          </ComboBox.Popover>
        </ComboBox>

        <div className="flex flex-col gap-2">
          <ComboBox
            fullWidth
            allowsEmptyCollection
            inputValue={portInput}
            items={portGroups}
            selectedKey={null}
            onInputChange={setPortInput}
            onSelectionChange={(key) => {
              if (!key) return;
              setPorts((current) => [...current, String(key)]);
              setPortInput("");
            }}
          >
            <Label>Ports of Entry</Label>
            <ComboBox.InputGroup>
              <Input placeholder="Search ports or countries..." />
              <ComboBox.Trigger />
            </ComboBox.InputGroup>
            <Description>
              Ports where this client's shipments arrive or clear customs.
            </Description>
            <ComboBox.Popover>
              <ListBox<(typeof portGroups)[number]>>
                {(group) => {
                  const Flag = getCountryFlag(group.id);

                  return (
                    <ListBox.Section id={group.id}>
                      <Header className="flex items-center gap-2">
                        {Flag && (
                          <Flag className="h-3 w-4 shrink-0 rounded-xs" />
                        )}
                        {group.country}
                      </Header>
                      <Collection items={group.ports}>
                        {(item) => (
                          <ListBox.Item id={item.id} textValue={item.id}>
                            {item.id}
                          </ListBox.Item>
                        )}
                      </Collection>
                    </ListBox.Section>
                  );
                }}
              </ListBox>
            </ComboBox.Popover>
          </ComboBox>

          {ports.length > 0 && (
            <TagGroup
              aria-label="Selected ports of entry"
              onRemove={(keys) =>
                setPorts((current) => current.filter((port) => !keys.has(port)))
              }
            >
              <TagGroup.List>
                {ports.map((port) => (
                  <Tag key={port} id={port} textValue={port}>
                    {port}
                    <Tag.RemoveButton />
                  </Tag>
                ))}
              </TagGroup.List>
            </TagGroup>
          )}
        </div>

        <RadioButtonGroup
          name="autonomy"
          value={autonomy}
          variant="secondary"
          onChange={setAutonomy}
        >
          <Label>Autonomy</Label>
          <Description>
            How entries for this client move through the pipeline.
          </Description>
          {AUTONOMY_OPTIONS.map((option) => (
            <RadioButtonGroup.Item key={option.value} value={option.value}>
              <RadioButtonGroup.Indicator />
              <RadioButtonGroup.ItemContent>
                <div className="flex items-center gap-2 pb-2">
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-md ${option.iconClassName}`}
                  >
                    <option.icon className="size-3" />
                  </span>
                  <Label>{option.label}</Label>
                </div>
                <Description>{option.description}</Description>
              </RadioButtonGroup.ItemContent>
            </RadioButtonGroup.Item>
          ))}
        </RadioButtonGroup>
      </Drawer.Body>

      <Drawer.Footer>
        <Button slot="close" variant="secondary">
          Cancel
        </Button>
        <Button isPending={isSaving} type="submit" variant="primary">
          {isEdit ? "Save Changes" : "Create Client"}
        </Button>
      </Drawer.Footer>
    </Form>
  );
}
