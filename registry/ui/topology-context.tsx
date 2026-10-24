'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_TOPOLOGY_DATA,
  type TopologyData,
  type TopologyDevice,
  type TopologyLink,
  type TopologyViewSettings,
} from './topology-types.js';

export type InspectorTab = 'overview' | 'interfaces' | 'neighbors' | 'metadata' | 'config';

export interface CameraState {
  x: number;
  y: number;
  k: number;
}

export interface TopologyContextValue {
  data: TopologyData;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  selectedDeviceId: string | null;
  selectedDevice: TopologyDevice | null;
  selectDevice: (id: string | null) => void;
  selectedLinkId: string | null;
  selectedLink: TopologyLink | null;
  selectLink: (id: string | null) => void;
  hoveredDeviceId: string | null;
  setHoveredDeviceId: (id: string | null) => void;
  activeZoneId: string | null;
  setActiveZoneId: (zoneId: string | null) => void;
  inspectorOpen: boolean;
  setInspectorOpen: (open: boolean) => void;
  inspectorTab: InspectorTab;
  setInspectorTab: (tab: InspectorTab) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  camera: CameraState;
  setCamera: (cam: CameraState | ((prev: CameraState) => CameraState)) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitView: () => void;
  focusDevice: (id: string) => void;
  viewSettings: TopologyViewSettings;
  updateViewSetting: <K extends keyof TopologyViewSettings>(
    key: K,
    value: TopologyViewSettings[K],
  ) => void;
  neighborsByDevice: Map<string, Set<string>>;
  linksByDevice: Map<string, TopologyLink[]>;
}

const TopologyContext = createContext<TopologyContextValue | null>(null);

export function useTopologyShell(): TopologyContextValue {
  const ctx = useContext(TopologyContext);
  if (!ctx) {
    throw new Error('useTopologyShell must be used inside <TopologyShell />');
  }
  return ctx;
}

export interface TopologyProviderProps {
  data?: TopologyData;
  defaultSelectedDeviceId?: string | null;
  defaultSidebarCollapsed?: boolean;
  children: ReactNode;
}

export function TopologyProvider({
  data = DEFAULT_TOPOLOGY_DATA,
  defaultSelectedDeviceId = 'hq-core-01',
  defaultSidebarCollapsed = false,
  children,
}: TopologyProviderProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(defaultSidebarCollapsed);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(defaultSelectedDeviceId);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [hoveredDeviceId, setHoveredDeviceId] = useState<string | null>(null);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(Boolean(defaultSelectedDeviceId));
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('overview');
  const [searchOpen, setSearchOpen] = useState(false);
  const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, k: 1 });
  const [viewSettings, setViewSettings] = useState<TopologyViewSettings>({
    labels: true,
    ports: true,
    motion: true,
    minimap: true,
    watermark: 'blueprint',
  });

  const deviceById = useMemo(
    () => new Map(data.devices.map((d) => [d.id, d])),
    [data.devices],
  );

  const linkById = useMemo(
    () => new Map(data.links.map((l) => [l.id, l])),
    [data.links],
  );

  const { neighborsByDevice, linksByDevice } = useMemo(() => {
    const neighbors = new Map<string, Set<string>>();
    const linksMap = new Map<string, TopologyLink[]>();
    for (const d of data.devices) {
      neighbors.set(d.id, new Set());
      linksMap.set(d.id, []);
    }
    for (const l of data.links) {
      neighbors.get(l.from.device)?.add(l.to.device);
      neighbors.get(l.to.device)?.add(l.from.device);
      linksMap.get(l.from.device)?.push(l);
      linksMap.get(l.to.device)?.push(l);
    }
    return { neighborsByDevice: neighbors, linksByDevice: linksMap };
  }, [data.devices, data.links]);

  const selectDevice = useCallback((id: string | null) => {
    setSelectedDeviceId(id);
    setSelectedLinkId(null);
    if (id) {
      setInspectorOpen(true);
    }
  }, []);

  const selectLink = useCallback((id: string | null) => {
    setSelectedLinkId(id);
    setSelectedDeviceId(null);
    if (id) {
      setInspectorOpen(true);
    }
  }, []);

  const zoomIn = useCallback(() => {
    setCamera((prev) => ({
      ...prev,
      k: Math.min(2.6, Number((prev.k * 1.2).toFixed(2))),
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setCamera((prev) => ({
      ...prev,
      k: Math.max(0.45, Number((prev.k / 1.2).toFixed(2))),
    }));
  }, []);

  const fitView = useCallback(() => {
    setCamera({ x: 0, y: 0, k: 1 });
    setActiveZoneId(null);
  }, []);

  const focusDevice = useCallback(
    (id: string) => {
      const dev = deviceById.get(id);
      if (!dev) return;
      selectDevice(id);
      const centerX = (data.width ?? 1000) / 2;
      const centerY = (data.height ?? 600) / 2;
      const targetK = 1.25;
      setCamera({
        x: (centerX - (dev.x ?? centerX)) * 0.65,
        y: (centerY - (dev.y ?? centerY)) * 0.65,
        k: targetK,
      });
    },
    [data.height, data.width, deviceById, selectDevice],
  );

  const updateViewSetting = useCallback(
    <K extends keyof TopologyViewSettings>(key: K, value: TopologyViewSettings[K]) => {
      setViewSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b' && !isInput) {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
        return;
      }

      if (isInput) return;

      if (e.key === 'Escape') {
        if (searchOpen) {
          setSearchOpen(false);
        } else if (inspectorOpen) {
          setInspectorOpen(false);
          setSelectedDeviceId(null);
          setSelectedLinkId(null);
        }
      } else if (e.key === 'f' || e.key === 'F') {
        fitView();
      } else if (e.key === '+' || e.key === '=') {
        zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        zoomOut();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fitView, inspectorOpen, searchOpen, zoomIn, zoomOut]);

  const selectedDevice = selectedDeviceId ? (deviceById.get(selectedDeviceId) ?? null) : null;
  const selectedLink = selectedLinkId ? (linkById.get(selectedLinkId) ?? null) : null;

  const value = useMemo<TopologyContextValue>(
    () => ({
      data,
      sidebarCollapsed,
      setSidebarCollapsed,
      selectedDeviceId,
      selectedDevice,
      selectDevice,
      selectedLinkId,
      selectedLink,
      selectLink,
      hoveredDeviceId,
      setHoveredDeviceId,
      activeZoneId,
      setActiveZoneId,
      inspectorOpen,
      setInspectorOpen,
      inspectorTab,
      setInspectorTab,
      searchOpen,
      setSearchOpen,
      camera,
      setCamera,
      zoomIn,
      zoomOut,
      fitView,
      focusDevice,
      viewSettings,
      updateViewSetting,
      neighborsByDevice,
      linksByDevice,
    }),
    [
      activeZoneId,
      camera,
      data,
      fitView,
      focusDevice,
      hoveredDeviceId,
      inspectorOpen,
      inspectorTab,
      linksByDevice,
      neighborsByDevice,
      searchOpen,
      selectDevice,
      selectLink,
      selectedDevice,
      selectedDeviceId,
      selectedLink,
      selectedLinkId,
      sidebarCollapsed,
      updateViewSetting,
      viewSettings,
      zoomIn,
      zoomOut,
    ],
  );

  return <TopologyContext.Provider value={value}>{children}</TopologyContext.Provider>;
}
