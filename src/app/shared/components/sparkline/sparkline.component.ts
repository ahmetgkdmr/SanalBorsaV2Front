import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="spark" [attr.viewBox]="'0 0 100 34'" preserveAspectRatio="none" aria-hidden="true">
      <path class="area" [attr.d]="areaPath()" [attr.fill]="color()" />
      <path [attr.d]="linePath()" [attr.stroke]="color()" fill="none" stroke-width="1.8" />
    </svg>
  `,
  styles: `
    .spark {
      margin-top: 10px;
      height: 34px;
      width: 100%;
      display: block;

      .area {
        stroke: none;
        opacity: 0.15;
      }
    }
  `,
})
export class SparklineComponent {
  readonly data = input.required<number[]>();
  readonly up = input(true);

  readonly color = computed(() => (this.up() ? 'var(--up)' : 'var(--down)'));

  readonly linePath = computed(() => this.buildPath(false));
  readonly areaPath = computed(() => this.buildPath(true));

  private buildPath(closed: boolean): string {
    const d = this.data();
    if (!d.length) return '';

    const h = 34;
    const w = 100;
    const min = Math.min(...d);
    const max = Math.max(...d);
    const range = max - min || 1;

    const pts = d.map((v, i) => {
      const x = (i / (d.length - 1 || 1)) * w;
      const y = h - 3 - ((v - min) / range) * (h - 6);
      return [x, y] as const;
    });

    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    return closed ? `${line} L ${w} ${h} L 0 ${h} Z` : line;
  }
}
