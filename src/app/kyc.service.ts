import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ActivityMeta, CountryMeta, FieldRule, FormSchema, FormValues } from './models';

@Injectable({ providedIn: 'root' })
export class KycService {
  private readonly http = inject(HttpClient);
  private stream: EventSource | null = null;
  private adaptTimer: number | null = null;

  readonly countries = signal<CountryMeta[]>([]);
  readonly activities = signal<ActivityMeta[]>([]);
  readonly country = signal('VE');
  readonly activity = signal('persona');
  readonly volumeUsd = signal(4200);
  readonly riskOverride = signal<'auto' | 'low' | 'mid' | 'high'>('auto');
  readonly schema = signal<FormSchema | null>(null);
  readonly values = signal<FormValues>({});
  readonly thinking = signal<string[]>([]);
  readonly jsonDraft = signal('');
  readonly streaming = signal(false);
  readonly prompt = signal('');
  readonly submitted = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly adapting = signal(false);

  readonly risk = computed(() => this.schema()?.risk ?? 'mid');

  setVolume(value: string | number) {
    this.volumeUsd.set(Number(value));
  }

  setRisk(value: string) {
    if (value === 'auto' || value === 'low' || value === 'mid' || value === 'high') {
      this.riskOverride.set(value);
    }
  }

  async boot() {
    const catalog = await firstValueFrom(
      this.http.get<{ countries: CountryMeta[]; activities: ActivityMeta[] }>('/api/kyc/catalog'),
    );
    this.countries.set(catalog.countries);
    this.activities.set(catalog.activities);
  }

  visible(field: FieldRule, values: FormValues = this.values()): boolean {
    const rule = field.when;
    if (!rule) {
      return true;
    }
    const current = values[rule.field];
    if (rule.op === 'truthy') {
      return Boolean(current);
    }
    if (rule.op === 'neq') {
      return String(current ?? '') !== String(rule.value ?? '');
    }
    return String(current ?? '') === String(rule.value ?? '');
  }

  patch(key: string, value: unknown) {
    this.values.update((current) => ({ ...current, [key]: value }));
    this.submitted.set(null);
    if (key === 'pep' || key === 'docKind') {
      this.scheduleAdapt();
    }
  }

  generate() {
    this.stream?.close();
    this.submitted.set(null);
    this.error.set(null);
    this.thinking.set([]);
    this.jsonDraft.set('');
    this.schema.set(null);
    this.values.set({});
    this.streaming.set(true);
    const query = new URLSearchParams({
      country: this.country(),
      activity: this.activity(),
      volumeUsd: String(this.volumeUsd()),
      risk: this.riskOverride(),
    });
    const es = new EventSource(`/api/kyc/generate?${query.toString()}`);
    this.stream = es;
    es.onmessage = (event) => {
      const data = JSON.parse(event.data) as {
        type: string;
        text?: string;
        prompt?: string;
        schema?: FormSchema;
      };
      if (data.type === 'meta' && data.prompt) {
        this.prompt.set(data.prompt);
      }
      if (data.type === 'think' && data.text) {
        this.thinking.update((lines) => [...lines, data.text as string]);
      }
      if (data.type === 'json' && data.text) {
        this.jsonDraft.update((raw) => raw + data.text);
      }
      if (data.type === 'schema' && data.schema) {
        this.applySchema(data.schema);
      }
      if (data.type === 'end') {
        this.streaming.set(false);
        es.close();
      }
    };
    es.onerror = () => {
      this.streaming.set(false);
      this.error.set('El stream de la IA se cortó. Reintenta generar.');
      es.close();
    };
  }

  private applySchema(schema: FormSchema) {
    this.schema.set(schema);
    const next: FormValues = { ...this.values() };
    for (const step of schema.steps) {
      for (const field of step.fields) {
        if (next[field.key] === undefined) {
          if (field.type === 'repeater') {
            next[field.key] = [{}];
          } else if (field.type === 'checkbox') {
            next[field.key] = false;
          } else if (field.value !== undefined) {
            next[field.key] = field.value;
          } else {
            next[field.key] = '';
          }
        }
      }
    }
    this.values.set(next);
  }

  private scheduleAdapt() {
    if (!this.schema() || this.streaming()) {
      return;
    }
    if (this.adaptTimer) {
      window.clearTimeout(this.adaptTimer);
    }
    this.adaptTimer = window.setTimeout(() => {
      void this.adapt();
    }, 350);
  }

  private async adapt() {
    const current = this.schema();
    if (!current) {
      return;
    }
    this.adapting.set(true);
    try {
      const body = await firstValueFrom(
        this.http.post<{ schema: FormSchema; thoughts: string[] }>('/api/kyc/adapt', {
          country: this.country(),
          activity: this.activity(),
          volumeUsd: this.volumeUsd(),
          risk: this.riskOverride(),
          answers: this.values(),
        }),
      );
      this.thinking.set(body.thoughts);
      this.jsonDraft.set(JSON.stringify(body.schema, null, 2));
      this.applySchema(body.schema);
    } catch {
      this.error.set('No pude adaptar el schema.');
    } finally {
      this.adapting.set(false);
    }
  }

  missing(): string[] {
    const schema = this.schema();
    if (!schema) {
      return [];
    }
    const values = this.values();
    const miss: string[] = [];
    for (const step of schema.steps) {
      for (const field of step.fields) {
        if (!field.required || !this.visible(field, values)) {
          continue;
        }
        const value = values[field.key];
        if (field.type === 'checkbox' && value !== true) {
          miss.push(field.label);
        } else if (field.type === 'repeater') {
          const rows = Array.isArray(value) ? value : [];
          if (rows.length < (field.minItems || 1)) {
            miss.push(field.label);
          }
        } else if (value === undefined || value === null || value === '') {
          miss.push(field.label);
        }
      }
    }
    return miss;
  }

  async submit() {
    const schema = this.schema();
    if (!schema) {
      return;
    }
    const missing = this.missing();
    if (missing.length) {
      this.error.set(`Faltan: ${missing.slice(0, 4).join(', ')}`);
      return;
    }
    this.error.set(null);
    const body = await firstValueFrom(
      this.http.post<{ ok: boolean; id: string }>('/api/kyc/submit', {
        schema,
        payload: this.values(),
      }),
    );
    this.submitted.set(body.id);
  }
}
