import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/spacious';
import { getLayoutTabs } from 'fumadocs-ui/layouts/shared';
import { baseOptions } from '@/lib/layout.shared';
import { getSection } from '@/lib/shared';
import type { CSSProperties, ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  const base = baseOptions();
  const tabs = getLayoutTabs(source.getPageTree(), {
    transform(option, node) {
      const meta = source.getNodeMeta(node);
      if (!meta || !node.icon) return option;
      const color = `var(--${getSection(meta.path)}-color, var(--color-fd-foreground))`;

      return {
        ...option,
        icon: (
          <div className="text-(--tab-color)" style={{ '--tab-color': color } as CSSProperties}>
            {node.icon}
          </div>
        ),
      };
    },
  });

  return (
    <DocsLayout
      {...base}
      tree={source.getPageTree()}
      tabs={tabs}
    >
      {children}
    </DocsLayout>
  );
}
