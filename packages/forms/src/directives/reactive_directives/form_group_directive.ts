/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Directive, EventEmitter, Inject, Input, OnChanges, Optional, Output, Self, SimpleChanges, forwardRef} from '@angular/core';
import {FormArray, FormControl, FormGroup} from '../../model';
import {NG_ASYNC_VALIDATORS, NG_VALIDATORS, Validators} from '../../validators';
import {ControlContainer} from '../control_container';
import {Form} from '../form_interface';
import {ReactiveErrors} from '../reactive_errors';
import {cleanUpControl, composeAsyncValidators, composeValidators, removeDir, setUpControl, setUpFormContainer, syncPendingControls} from '../shared';

import {FormControlName} from './form_control_name';
import {FormArrayName, FormGroupName} from './form_group_name';

export const formDirectiveProvider: any = {
  provide: ControlContainer,
  useExisting: forwardRef(() => FormGroupDirective)
};

/**
 * @description
 *
 * Binds an existing `FormGroup` to a DOM element.
 *
 * This directive accepts an existing `FormGroup` instance. It will then use this
 * `FormGroup` instance to match any child `FormControl`, `FormGroup`,
 * and `FormArray` instances to child `FormControlName`, `FormGroupName`,
 * and `FormArrayName` directives.
 *
 * **Set value**: You can set the form's initial value when instantiating the
 * `FormGroup`, or you can set it programmatically later using the `FormGroup`'s
 * {@link AbstractControl#setValue setValue} or {@link AbstractControl#patchValue patchValue}
 * methods.
 *
 * **Listen to value**: If you want to listen to changes in the value of the form, you can subscribe
 * to the `FormGroup`'s {@link AbstractControl#valueChanges valueChanges} event.  You can also
 * listen to its {@link AbstractControl#statusChanges statusChanges} event to be notified when the
 * validation status is re-calculated.
 *
 * Furthermore, you can listen to the directive's `ngSubmit` event to be notified when the user has
 * triggered a form submission. The `ngSubmit` event will be emitted with the original form
 * submission event.
 *
 * ### Example
 *
 * In this example, we create form controls for first name and last name.
 *
 * {@example forms/ts/simpleFormGroup/simple_form_group_example.ts region='Component'}
 *
 * @ngModule ReactiveFormsModule
 */
@Directive({
  selector: '[formGroup]',
  providers: [formDirectiveProvider],
  host: {'(submit)': 'onSubmit($event)', '(reset)': 'onReset()'},
  exportAs: 'ngForm'
})
export class FormGroupDirective extends ControlContainer implements Form,
    OnChanges {
  public readonly submitted: boolean = false;

  // TODO(issue/24571): remove '!'.
  private _oldForm !: FormGroup;
  directives: FormControlName[] = [];

  @Input('formGroup') form: FormGroup = null !;
  @Output() ngSubmit = new EventEmitter();

  constructor(
      @Optional() @Self() @Inject(NG_VALIDATORS) private _validators: any[],
      @Optional() @Self() @Inject(NG_ASYNC_VALIDATORS) private _asyncValidators: any[]) {
    super();
  }

  ngOnChanges(changes: SimpleChanges): void {
    this._checkFormPresent();
    if (changes.hasOwnProperty('form')) {
      this._updateValidators();
      this._updateDomValue();
      this._updateRegistrations();
    }
  }

  get formDirective(): Form { return this; }

  get control(): FormGroup { return this.form; }

  get path(): string[] { return []; }

  addControl(dir: FormControlName): FormControl {
    const ctrl: any = this.form.get(dir.path);
    setUpControl(ctrl, dir);
    ctrl.updateValueAndValidity({emitEvent: false});
    this.directives.push(dir);
    return ctrl;
  }

  getControl(dir: FormControlName): FormControl { return <FormControl>this.form.get(dir.path); }

  removeControl(dir: FormControlName): void { removeDir<FormControlName>(this.directives, dir); }

  addFormGroup(dir: FormGroupName): void {
    const ctrl: any = this.form.get(dir.path);
    setUpFormContainer(ctrl, dir);
    ctrl.updateValueAndValidity({emitEvent: false});
  }

  removeFormGroup(dir: FormGroupName): void {}

  getFormGroup(dir: FormGroupName): FormGroup { return <FormGroup>this.form.get(dir.path); }

  addFormArray(dir: FormArrayName): void {
    const ctrl: any = this.form.get(dir.path);
    setUpFormContainer(ctrl, dir);
    ctrl.updateValueAndValidity({emitEvent: false});
  }

  removeFormArray(dir: FormArrayName): void {}

  getFormArray(dir: FormArrayName): FormArray { return <FormArray>this.form.get(dir.path); }

  updateModel(dir: FormControlName, value: any): void {
    const ctrl?? = <FormControl>this.form.get(dir.path);
    ctrl.setValue(value);
  }

  onSubmit($event: Event): boolean {
    (this as{submitted: boolean}).submitted = true;
    syncPendingControls(this.form, this.directives);
    this.ngSubmit.emit($event);
    return false;
  }

  onReset(): void { this.resetForm(); }

  resetForm(value: any = undefined): void {
    this.form.reset(value);
    (this as{submitted: boolean}).submitted = false;
  }


  /** @internal */
  _updateDomValue() {
    this.directives.forEach(dir => {
      const newCtrl: any = this.form.get(dir.path);
      if (dir.control !== newCtrl) {
        cleanUpControl(dir.control, dir);
        if (newCtrl) setUpControl(newCtrl, dir);
        (dir as{control: FormControl}).control = newCtrl;
      }
    });

    this.form._updateTreeValidity({emitEvent: false});
  }

  private _updateRegistrations() {
    this.form._registerOnCollectionChange(() => this._updateDomValue());
    if (this._oldForm) this._oldForm._registerOnCollectionChange(() => {});
    this._oldForm = this.form;
  }

  private _updateValidators() {
    const sync = composeValidators(this._validators);
    this.form.validator = Validators.compose([this.form.validator !, sync !]);

    const async = composeAsyncValidators(this._asyncValidators);
    this.form.asyncValidator = Validators.composeAsync([this.form.asyncValidator !, async !]);
  }

  private _checkFormPresent() {
    if (!this.form) {
      ReactiveErrors.missingFormException();
    }
  }
}
