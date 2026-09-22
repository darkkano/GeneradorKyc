import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FieldRule, FormValues } from './models';

@Component({
  selector: 'lince-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label>
      <span>{{ field().label }} @if (field().required) { <em>*</em> }</span>
      <input
        [type]="inputType()"
        [attr.autocomplete]="field().autocomplete || null"
        [attr.pattern]="field().pattern || null"
        [value]="asString()"
        (input)="changed.emit(($any($event.target)).value)"
      />
      @if (field().hint) {
        <small>{{ field().hint }}</small>
      }
    </label>
  `,
})
export class TextField {
  readonly field = input.required<FieldRule>();
  readonly value = input<unknown>('');
  readonly changed = output<unknown>();
  inputType() {
    const type = this.field().type;
    if (type === 'email' || type === 'tel' || type === 'date') {
      return type;
    }
    return 'text';
  }
  asString() {
    return this.value() == null ? '' : String(this.value());
  }
}

@Component({
  selector: 'lince-area',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label>
      <span>{{ field().label }} @if (field().required) { <em>*</em> }</span>
      <textarea rows="3" [value]="asString()" (input)="changed.emit(($any($event.target)).value)"></textarea>
      @if (field().hint) {
        <small>{{ field().hint }}</small>
      }
    </label>
  `,
})
export class AreaField {
  readonly field = input.required<FieldRule>();
  readonly value = input<unknown>('');
  readonly changed = output<unknown>();
  asString() {
    return this.value() == null ? '' : String(this.value());
  }
}

@Component({
  selector: 'lince-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label>
      <span>{{ field().label }} @if (field().required) { <em>*</em> }</span>
      <select [value]="asString()" (change)="changed.emit(($any($event.target)).value)">
        <option value="">Elegir…</option>
        @for (opt of field().options || []; track opt.value) {
          <option [value]="opt.value">{{ opt.label }}</option>
        }
      </select>
    </label>
  `,
})
export class SelectField {
  readonly field = input.required<FieldRule>();
  readonly value = input<unknown>('');
  readonly changed = output<unknown>();
  asString() {
    return this.value() == null ? '' : String(this.value());
  }
}

@Component({
  selector: 'lince-radio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset>
      <legend>{{ field().label }} @if (field().required) { <em>*</em> }</legend>
      @for (opt of field().options || []; track opt.value) {
        <label class="inline">
          <input
            type="radio"
            [name]="field().key"
            [value]="opt.value"
            [checked]="asString() === opt.value"
            (change)="changed.emit(opt.value)"
          />
          {{ opt.label }}
        </label>
      }
    </fieldset>
  `,
})
export class RadioField {
  readonly field = input.required<FieldRule>();
  readonly value = input<unknown>('');
  readonly changed = output<unknown>();
  asString() {
    return this.value() == null ? '' : String(this.value());
  }
}

@Component({
  selector: 'lince-check',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="inline">
      <input type="checkbox" [checked]="value() === true" (change)="changed.emit(($any($event.target)).checked)" />
      <span>{{ field().label }} @if (field().required) { <em>*</em> }</span>
    </label>
  `,
})
export class CheckField {
  readonly field = input.required<FieldRule>();
  readonly value = input<unknown>(false);
  readonly changed = output<unknown>();
}

@Component({
  selector: 'lince-money',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label>
      <span>{{ field().label }} @if (field().required) { <em>*</em> }</span>
      <input
        type="number"
        step="0.01"
        [attr.min]="field().min ?? null"
        [attr.max]="field().max ?? null"
        [value]="value() ?? ''"
        (input)="onInput($event)"
      />
    </label>
  `,
})
export class MoneyField {
  readonly field = input.required<FieldRule>();
  readonly value = input<unknown>('');
  readonly changed = output<unknown>();

  onInput(event: Event) {
    this.changed.emit(Number((event.target as HTMLInputElement).value));
  }
}

@Component({
  selector: 'lince-file',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label>
      <span>{{ field().label }} @if (field().required) { <em>*</em> }</span>
      <input type="file" [attr.accept]="field().accept || 'image/*'" (change)="onFile($event)" />
      @if (preview()) {
        <img [src]="preview()" alt="" />
      }
      @if (field().hint) {
        <small>{{ field().hint }}</small>
      }
    </label>
  `,
})
export class FileField {
  readonly field = input.required<FieldRule>();
  readonly value = input<unknown>(null);
  readonly changed = output<unknown>();

  preview() {
    const value = this.value() as { dataUrl?: string } | string | null;
    if (!value) {
      return '';
    }
    if (typeof value === 'string') {
      return value.startsWith('data:') ? value : '';
    }
    return value.dataUrl || '';
  }

  onFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      this.changed.emit(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.changed.emit({ name: file.name, type: file.type, dataUrl: String(reader.result) });
    };
    reader.readAsDataURL(file);
  }
}

@Component({
  selector: 'lince-repeater',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TextField, MoneyField],
  template: `
    <div class="rep">
      <header>
        <span>{{ field().label }} @if (field().required) { <em>*</em> }</span>
        <button type="button" (click)="add()" [disabled]="rows().length >= (field().maxItems || 8)">Añadir</button>
      </header>
      @for (row of rows(); track $index; let i = $index) {
        <article>
          <b>{{ field().itemLabel || 'Ítem' }} {{ i + 1 }}</b>
          @for (child of field().fields || []; track child.key) {
            @if (child.type === 'money') {
              <lince-money [field]="child" [value]="$any(row)[child.key]" (changed)="patch(i, child.key, $event)" />
            } @else {
              <lince-text [field]="child" [value]="$any(row)[child.key]" (changed)="patch(i, child.key, $event)" />
            }
          }
          <button type="button" class="ghost" (click)="remove(i)">Quitar</button>
        </article>
      }
    </div>
  `,
})
export class RepeaterField {
  readonly field = input.required<FieldRule>();
  readonly value = input<unknown>([]);
  readonly changed = output<unknown>();

  rows(): FormValues[] {
    return Array.isArray(this.value()) ? (this.value() as FormValues[]) : [];
  }

  add() {
    this.changed.emit([...this.rows(), {}]);
  }

  remove(index: number) {
    this.changed.emit(this.rows().filter((_, i) => i !== index));
  }

  patch(index: number, key: string, value: unknown) {
    const next = this.rows().map((row, i) => (i === index ? { ...row, [key]: value } : row));
    this.changed.emit(next);
  }
}

@Component({
  selector: 'lince-smart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TextField,
    AreaField,
    SelectField,
    RadioField,
    CheckField,
    MoneyField,
    FileField,
    RepeaterField,
  ],
  template: `
    @switch (field().type) {
      @case ('textarea') {
        <lince-area [field]="field()" [value]="value()" (changed)="changed.emit($event)" />
      }
      @case ('select') {
        <lince-select [field]="field()" [value]="value()" (changed)="changed.emit($event)" />
      }
      @case ('radio') {
        <lince-radio [field]="field()" [value]="value()" (changed)="changed.emit($event)" />
      }
      @case ('checkbox') {
        <lince-check [field]="field()" [value]="value()" (changed)="changed.emit($event)" />
      }
      @case ('file') {
        <lince-file [field]="field()" [value]="value()" (changed)="changed.emit($event)" />
      }
      @case ('money') {
        <lince-money [field]="field()" [value]="value()" (changed)="changed.emit($event)" />
      }
      @case ('repeater') {
        <lince-repeater [field]="field()" [value]="value()" (changed)="changed.emit($event)" />
      }
      @default {
        <lince-text [field]="field()" [value]="value()" (changed)="changed.emit($event)" />
      }
    }
  `,
})
export class SmartField {
  readonly field = input.required<FieldRule>();
  readonly value = input<unknown>(null);
  readonly values = input<FormValues>({});
  readonly changed = output<unknown>();
}
