import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import {
  MarrowEmbed,
  MarrowDiagram,
  TopologyCanvas,
  TopologyViewport,
  CableBadge,
} from '@marrow/ui';
import { ComponentPreview } from './component-preview';
import { DemoStudio } from './demo-studio';
import {
  ReloadWorkflowVisual,
  CompilePipelineVisual,
  ArchetypeDecisionVisual,
  AgentGoldenLoopVisual,
  EmbeddingProtocolVisual,
  SpaciousGridArchitectureVisual,
  SelfHealingLoopVisual,
  PackageLayersVisual,
  TierHierarchyVisual,
} from './visual-flows';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    DemoStudio,
    ComponentPreview,
    ReloadWorkflowVisual,
    CompilePipelineVisual,
    ArchetypeDecisionVisual,
    AgentGoldenLoopVisual,
    EmbeddingProtocolVisual,
    SpaciousGridArchitectureVisual,
    SelfHealingLoopVisual,
    PackageLayersVisual,
    TierHierarchyVisual,
    MarrowEmbed,
    MarrowDiagram,
    TopologyCanvas: MarrowEmbed,
    TopologyViewport: MarrowEmbed,
    CableBadge,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
