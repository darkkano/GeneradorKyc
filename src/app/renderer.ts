import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SmartField } from './fields';
import { KycService } from './kyc.service';

@Component({
  selector: 'lince-renderer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SmartField],
  template: `
    @if (kyc.schema(); as schema) {
      <form class="sheet" (submit)="$event.preventDefault(); kyc.submit()">
        <header>
          <h2>{{ schema.title }}</h2>
          <p>{{ schema.rationale }}</p>
          <b [attr.data-risk]="schema.risk">riesgo {{ schema.risk }}</b>
        </header>
        @for (step of schema.steps; track step.id) {
          <section>
            <h3>{{ step.title }}</h3>
            @if (step.description) {
              <p>{{ step.description }}</p>
            }
            @for (field of step.fields; track field.key) {
              @if (kyc.visible(field)) {
                <lince-smart
                  [field]="field"
                  [value]="kyc.values()[field.key]"
                  [values]="kyc.values()"
                  (changed)="kyc.patch(field.key, $event)"
                />
              }
            }
          </section>
        }
        <footer>
          <button type="submit" [disabled]="kyc.streaming()">Enviar expediente</button>
          @if (kyc.adapting()) {
            <small>La IA está recortando campos…</small>
          }
          @if (kyc.submitted(); as id) {
            <small class="ok">Guardado {{ id }}</small>
          }
          @if (kyc.error(); as err) {
            <small class="bad">{{ err }}</small>
          }
        </footer>
      </form>
    } @else {
      <div class="empty">
        <p>No hay HTML de formulario en el repo. Elige país y pulsa <b>Pedir reglas a la IA</b>.</p>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class Renderer {
  readonly kyc = inject(KycService);
}
