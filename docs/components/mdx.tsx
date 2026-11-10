import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { MarrowEmbed, CableBadge, DeviceLink } from '@marrow/ui';
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
    CableBadge,
    DeviceLink,
    ...components,
  } satisfies MDXComponents;
}

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
