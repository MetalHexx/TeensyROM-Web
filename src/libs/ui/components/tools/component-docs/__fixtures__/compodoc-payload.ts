import { CompodocEntity, CompodocJson } from '../compodoc-source';

/**
 * Entities copied from a freshly emitted `documentation.json` and trimmed to the fields this
 * layer reads, so parsing is checked against the shape compodoc actually produces.
 */
export const cardLayoutEntity: CompodocEntity = {
  name: 'CardLayoutComponent',
  id: 'component-CardLayoutComponent-1d4df86118c0',
  file: 'libs/ui/components/src/lib/card-layout/card-layout.component.ts',
  selector: 'lib-card-layout',
  description:
    '<p>Card layout component with support for title, subtitle, corner slot, and header slot.</p>\n',
  rawdescription:
    '\n\nCard layout component with support for title, subtitle, corner slot, and header slot.\n\n**Header Slot**: Project custom content into the card header using `slot="header"`.\nThis content appears above the title/subtitle when both are provided.\n\n```html\n<lib-card-layout title="Card Title">\n  <custom-nav slot="header"></custom-nav>\n</lib-card-layout>\n```',
  inputsClass: [
    {
      name: 'cardClass',
      type: 'string',
      defaultValue: "''",
      description: '',
      rawdescription: '\n',
      line: 46,
      required: false,
    },
    {
      name: 'glassyIntensity',
      type: 'GlassyIntensity',
      defaultValue: "'dark'",
      description: '<p>Glassy effect intensity (default: &#39;dark&#39;)</p>\n',
      rawdescription: '\n\nGlassy effect intensity (default: \'dark\')\n',
      line: 59,
      required: false,
    },
    {
      name: 'metadataSource',
      type: 'string',
      description: '',
      rawdescription: '\n',
      line: 44,
      required: true,
    },
  ],
  outputsClass: [
    {
      name: 'cardClosed',
      type: 'void',
      description: '',
      rawdescription: '\n',
      line: 62,
      required: false,
    },
  ],
  jsdoctags: [{ tagName: { escapedText: 'example' }, comment: '<b>Example :</b>' }],
};

export const tooltipDirectiveEntity: CompodocEntity = {
  name: 'TooltipDirective',
  id: 'directive-TooltipDirective-49ade37496d2',
  file: 'libs/ui/components/src/lib/tooltip/tooltip.directive.ts',
  selector: '[libTooltip]',
  description: '<p>Tooltip Directive</p>\n',
  rawdescription:
    '\n\nTooltip Directive\n\nProvides tooltip functionality via attribute directive with intelligent device detection.\n\n```html\n<button [libTooltip]="{ body: \'Save\' }">Save</button>\n```',
  inputsClass: [
    {
      name: 'libTooltip',
      type: 'TooltipConfig | undefined',
      description: '<p>Tooltip configuration (optional - no tooltip shown if undefined)</p>\n',
      rawdescription: '\n\nTooltip configuration (optional - no tooltip shown if undefined)\n',
      line: 103,
      required: false,
    },
  ],
  outputsClass: [],
  jsdoctags: [{ tagName: { escapedText: 'example' }, comment: '<b>Example :</b>' }],
};

/** A documented unit with no `@example` tag and no story file of its own. */
export const undocumentedEntity: CompodocEntity = {
  name: 'LoadingTextComponent',
  id: 'component-LoadingTextComponent-a91f0c2e77bd',
  file: 'libs/ui/components/src/lib/loading-text/loading-text.component.ts',
  selector: 'lib-loading-text',
  description: '',
  rawdescription: '',
  inputsClass: [],
  outputsClass: [],
};

export const compodocPayload: CompodocJson = {
  components: [cardLayoutEntity, undocumentedEntity],
  directives: [tooltipDirectiveEntity],
  classes: [],
  injectables: [],
  interfaces: [],
  miscellaneous: {},
  coverage: {
    count: 47,
    status: 'medium',
    files: [
      {
        filePath: 'libs/ui/components/src/lib/card-layout/card-layout.component.ts',
        type: 'component',
        linktype: 'component',
        name: 'CardLayoutComponent',
        coveragePercent: 60,
        coverageCount: '3/5',
        status: 'medium',
      },
    ],
  },
};
