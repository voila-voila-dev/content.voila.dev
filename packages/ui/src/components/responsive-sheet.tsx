import * as React from "react";
import { Drawer } from "#components/drawer";
import { Sheet } from "#components/sheet";
import { useIsMobile } from "#hooks/use-mobile";

// Single source of truth for the desktop/mobile branch within one
// ResponsiveSheet instance. Without it, each child would call `useIsMobile()`
// independently and could disagree mid-render — putting e.g. a `Sheet.Trigger`
// outside its `Sheet.Root`, which throws.
const IsMobileContext = React.createContext<boolean | null>(null);

function useResponsiveSheetIsMobile(): boolean {
  const value = React.useContext(IsMobileContext);
  if (value === null) {
    throw new Error("ResponsiveSheet child must be rendered inside <ResponsiveSheet.Root>");
  }
  return value;
}

type RootProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

function Root({ children, open, defaultOpen, onOpenChange }: RootProps) {
  const isMobile = useIsMobile();
  const handleOpenChange: NonNullable<React.ComponentProps<typeof Sheet.Root>["onOpenChange"]> = (
    next,
  ) => {
    onOpenChange?.(next);
  };
  return (
    <IsMobileContext.Provider value={isMobile}>
      {isMobile ? (
        <Drawer.Root open={open} defaultOpen={defaultOpen} onOpenChange={handleOpenChange}>
          {children}
        </Drawer.Root>
      ) : (
        <Sheet.Root open={open} defaultOpen={defaultOpen} onOpenChange={handleOpenChange}>
          {children}
        </Sheet.Root>
      )}
    </IsMobileContext.Provider>
  );
}

function Trigger({ children }: { children: React.ReactElement<Record<string, unknown>> }) {
  const isMobile = useResponsiveSheetIsMobile();
  return isMobile ? <Drawer.Trigger render={children} /> : <Sheet.Trigger render={children} />;
}

type ContentProps = React.ComponentProps<typeof Sheet.Content>;

function Content({ children, className, ...props }: ContentProps) {
  const isMobile = useResponsiveSheetIsMobile();
  if (isMobile) {
    return <Drawer.Content className={className}>{children}</Drawer.Content>;
  }
  return (
    <Sheet.Content className={className} {...props}>
      {children}
    </Sheet.Content>
  );
}

function Header(props: React.ComponentProps<"div">) {
  const isMobile = useResponsiveSheetIsMobile();
  return isMobile ? <Drawer.Header {...props} /> : <Sheet.Header {...props} />;
}

function Footer(props: React.ComponentProps<"div">) {
  const isMobile = useResponsiveSheetIsMobile();
  return isMobile ? <Drawer.Footer {...props} /> : <Sheet.Footer {...props} />;
}

function Title(props: React.ComponentProps<typeof Sheet.Title>) {
  const isMobile = useResponsiveSheetIsMobile();
  return isMobile ? <Drawer.Title {...props} /> : <Sheet.Title {...props} />;
}

function Description(props: React.ComponentProps<typeof Sheet.Description>) {
  const isMobile = useResponsiveSheetIsMobile();
  return isMobile ? <Drawer.Description {...props} /> : <Sheet.Description {...props} />;
}

function Close({ children }: { children: React.ReactElement<Record<string, unknown>> }) {
  const isMobile = useResponsiveSheetIsMobile();
  return isMobile ? <Drawer.Close render={children} /> : <Sheet.Close render={children} />;
}

/**
 * Sheet on desktop, bottom Drawer on mobile. Mirrors the namespaced
 * primitive API of `Sheet` / `Drawer` so callers can swap with a single
 * find-and-replace.
 */
export const ResponsiveSheet = {
  Root,
  Trigger,
  Content,
  Header,
  Footer,
  Title,
  Description,
  Close,
};
