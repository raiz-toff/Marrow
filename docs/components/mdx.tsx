import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import {
  TopologyShell,
  TopologyCanvas,
  TopologySidebar,
  TopologyTreeView,
  TopologyLegend,
  TopologyStatusLegend,
  TopologyLinkLegend,
  TopologyInspector,
  TopologyControls,
  TopologyMinimap,
  TopologySearch,
  TopologyProvider,
} from '@marrow/ui';
import { ComponentPreview, TopologySearchTrigger } from './component-preview';
import {
  InspectorShowcase,
  ControlsShowcase,
  CompleteShellShowcase,
  ComponentWorkbench,
  SidebarShowcase,
  TreeViewShowcase,
  LegendShowcase,
  SearchShowcase,
} from './component-showcases';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    ComponentPreview,
    InspectorShowcase,
    ControlsShowcase,
    CompleteShellShowcase,
    ComponentWorkbench,
    SidebarShowcase,
    TreeViewShowcase,
    LegendShowcase,
    SearchShowcase,
    TopologyShell,
    TopologyCanvas,
    TopologyViewport: TopologyCanvas,
    TopologySidebar,
    TopologyTreeView,
    TopologyLegend,
    TopologyStatusLegend,
    TopologyLinkLegend,
    TopologyInspector,
    TopologyControls,
    TopologyMinimap,
    TopologySearch,
    TopologySearchTrigger,
    TopologyProvider,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
