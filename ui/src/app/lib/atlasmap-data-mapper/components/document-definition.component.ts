/*
    Copyright (C) 2017 Red Hat, Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

            http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

import { Component, Input, ViewChildren, ElementRef, EventEmitter, QueryList, ViewChild, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { DocumentType, InspectionType } from '../common/config.types';
import { DataMapperUtil } from '../common/data-mapper-util';

import { ConfigModel, AdmRedrawMappingLinesEvent } from '../models/config.model';
import { Field } from '../models/field.model';
import { DocumentDefinition } from '../models/document-definition.model';

import { ClassNameComponent } from './class-name.component';
import { DocumentFieldDetailComponent } from './document-field-detail.component';
import { PropertyFieldEditComponent } from './property-field-edit.component';
import { ConstantFieldEditComponent } from './constant-field-edit.component';
import { FieldEditComponent } from './field-edit.component';

import { LineMachineComponent } from './line-machine.component';
import { ModalWindowComponent } from './modal-window.component';

@Component({
  selector: 'document-definition',
  templateUrl: './document-definition.component.html',
})

export class DocumentDefinitionComponent implements OnInit {
  @Input() cfg: ConfigModel;
  @Input() isSource = false;
  @Input() modalWindow: ModalWindowComponent;

  @ViewChild('documentDefinitionElement') documentDefinitionElement: ElementRef;
  @ViewChildren('fieldDetail') fieldComponents: QueryList<DocumentFieldDetailComponent>;
  @ViewChildren('docDetail') docElements: QueryList<ElementRef>;

  dataSource: Observable<any>;

  private searchFieldCount = 0;
  private lineMachine: LineMachineComponent = null;
  private maxSearchMatch = 10000;
  private redrawMappingLinesEvent = new EventEmitter<AdmRedrawMappingLinesEvent>(true);
  private searchMode = false;
  private searchFilter = '';
  private scrollTop = 0;
  private searchResultsExist = false;
  private sourcesTargetsLabel: string;

  constructor() {
    this.dataSource = Observable.create((observer: any) => {
      observer.next(this.search(this.searchFilter));
    });
  }

  ngOnInit(): void {
    if (this.isSource) {
      this.sourcesTargetsLabel = (this.cfg.sourceDocs.length > 1) ? 'Sources' : 'Source';
    } else {
      this.sourcesTargetsLabel = (this.cfg.targetDocs.length > 1) ? 'Targets' : 'Target';
    }
  }

  getDocs() {
    return this.cfg.getDocs(this.isSource);
  }

  getLineMachine(): LineMachineComponent {
    return this.lineMachine;
  }

  setLineMachine(lm: LineMachineComponent): void {
    this.lineMachine = lm;
    if (this.redrawMappingLinesEvent.observers.length === 0) {
      this.redrawMappingLinesEvent.subscribe((event: AdmRedrawMappingLinesEvent) =>
        this.lineMachine.handleRedrawMappingLinesEvent(event));
    }
  }

  getDocDefElementPosition(docDef: DocumentDefinition): any {
    for (const c of this.docElements.toArray()) {
      if (c.nativeElement.id === docDef.name) {
        const documentElementAbsPosition: any = this.getElementPositionForElement(c.nativeElement, false, true);
        const myElement: any = this.documentDefinitionElement.nativeElement;
        const myAbsPosition: any = this.getElementPositionForElement(myElement, false, false);
        return {
          'x': (documentElementAbsPosition.x - myAbsPosition.x),
          'y': (documentElementAbsPosition.y - myAbsPosition.y)
        };
      }
    }
    return null;
  }

  getFieldDetailComponent(field: Field): DocumentFieldDetailComponent {
    for (const c of this.fieldComponents.toArray()) {
      const returnedComponent: DocumentFieldDetailComponent = c.getFieldDetailComponent(field);
      if (returnedComponent != null) {
        return returnedComponent;
      }
    }
    return null;
  }

  getElementPosition(): any {
    return this.getElementPositionForElement(this.documentDefinitionElement.nativeElement, true, false);
  }

  getElementPositionForElement(el: any, addScrollTop: boolean, subtractScrollTop: boolean): any {
    let x = 0;
    let y = 0;

    while (el != null) {
      x += el.offsetLeft;
      y += el.offsetTop;
      el = el.offsetParent;
    }
    if (addScrollTop) {
      y += this.scrollTop;
    }
    if (subtractScrollTop) {
      y -= this.scrollTop;
    }
    return { 'x': x, 'y': y };
  }

  getFieldDetailComponentPosition(field: Field): any {
    const c: DocumentFieldDetailComponent = this.getFieldDetailComponent(field);
    if (c == null) {
      return null;
    }
    const fieldElementAbsPosition: any = c.getElementPosition();
    const myAbsPosition: any = this.getElementPosition();
    return { 'x': (fieldElementAbsPosition.x - myAbsPosition.x), 'y': (fieldElementAbsPosition.y - myAbsPosition.y) };
  }

  getImportIconCSSClass(): string {
    return'pficon pficon-import importExportIcon link';
  }

  getExportIconCSSClass(): string {
    return'pficon pficon-export importExportIcon link';
  }

  getPlusSquareIconCSSClass(): string {
    return 'fa fa-plus-square';
  }

  /**
   * Using the specified event, determine and read the selected file and call the document service to
   * process it.  Also update the runtime catalog.
   *
   * @param event
   */
  async processDoc(event) {
    const selectedFile = event.target.files[0];
    this.cfg.initCfg.initialized = false;
    this.cfg.initializationService.updateLoadingStatus('Importing Document ' + selectedFile.name);
    this.cfg.documentService.processDocument(selectedFile, InspectionType.UNKNOWN, this.isSource)
    .then(() => {
      this.cfg.fileService.exportMappingsCatalog(null);
     });
  }

  getFileSuffix() {
    return '.json,.xml,.xsd';
  }

  exportFile(): string {
    return '';
  }

  getSearchIconCSSClass(): string {
    const cssClass = 'fa fa-search searchBoxIcon link';
    return this.searchMode ? (cssClass + ' selectedIcon') : cssClass;
  }

  getFieldCount(): number {
    let count = 0;
    for (const docDef of this.cfg.getDocs(this.isSource)) {
      if (docDef && docDef.allFields) {
        count += docDef.allFields.length;
      }
    }
    return count;
  }

  /**
   * Handle scrolling in this document definition instance.  Avoid a circular dependence with the
   * LineMachineComponent by dispatching a custom Angular mappings-line-redraw event.
   * @param event
   */
  handleScroll(event: any) {
    this.scrollTop = event.target.scrollTop;
    this.redrawMappingLinesEvent.emit({_lmcInstance: this.lineMachine});
  }

  toggleSearch(): void {
    this.searchMode = !this.searchMode;
    this.search(this.searchMode ? this.searchFilter : '');
  }

  /**
   * Establish a dialog where the user will specify a class name to be made available in the
   * targeted panel for use in field mapping or custom transformations.  The user must have
   * previously imported the JAR file containing the class. The user-defined class will establish
   * either an instance of mappable fields or custom transformation methods.
   *
   * @param event
   */
  queryClassName(event: any): void {
    const docDefs = this.getDocs();
    const docDef = docDefs[0];
    event.stopPropagation();
    this.getDocs().push(docDef);
    const self = this;
    this.modalWindow.reset();
    this.modalWindow.headerText = 'Establish your class in the ' + (this.isSource ? 'Sources' : 'Targets') + ' panel.';
    this.modalWindow.nestedComponentType = ClassNameComponent;

    this.modalWindow.nestedComponentInitializedCallback = (mw: ModalWindowComponent) => {
      const classNameComponent = mw.nestedComponent as ClassNameComponent;
      classNameComponent.isSource = this.isSource;
      classNameComponent.initialize(null, docDef, true);
    };

    this.modalWindow.okButtonHandler = (mw: ModalWindowComponent) => {
      const classNameComponent = mw.nestedComponent as ClassNameComponent;
      const docdef = self.cfg.initializationService.addJavaDocument(
        classNameComponent.userClassName, self.isSource,
        classNameComponent.userCollectionType, classNameComponent.userCollectionClassName);
      docdef.name = classNameComponent.userClassName;
      docdef.isSource = self.isSource;
      docdef.updateFromMappings(this.cfg.mappings);

      this.cfg.documentService.fetchClassPath().toPromise()
        .then((classPath: string) => {
          this.cfg.initCfg.classPath = classPath;
            this.cfg.documentService.fetchDocument(docdef, this.cfg.initCfg.classPath).toPromise()
            .then(async (doc: DocumentDefinition) => {

              // No fields indicate the user is attempting to enable a custom field action class.  Remove
              // the document from the panel since it has no fields.
              if (doc.fields.length === 0) {

                // Make any custom field actions active.
                await self.cfg.fieldActionService.fetchFieldActions()
                .catch((error: any) => {
                  self.cfg.errorService.error(error, null);
                });

                if (doc.isSource) {
                  DataMapperUtil.removeItemFromArray(doc, this.cfg.sourceDocs);
                } else {
                  DataMapperUtil.removeItemFromArray(doc, this.cfg.targetDocs);
                }
              }
              await self.cfg.mappingService.notifyMappingUpdated();
              await self.cfg.fileService.exportMappingsCatalog(null);
            })
            .catch((error: any) => {
              if (error.status === 0) {
                self.cfg.errorService.error('Unable to fetch the Java class document ' + docdef.name + ' from the runtime service.', error);
              } else {
                self.cfg.errorService.error('Could not load the Java class document \'' + docdef.id + '\'', error);
              }
            });
        })
        .catch((error: any) => {
          if (error.status === 0) {
            self.cfg.errorService.error('Fatal network error: Could not connect to AtlasMap design runtime service.', error);
          } else {
            self.cfg.errorService.error('Could not load the Java class path.', error);
          }
        });
    };
    this.modalWindow.show();
  }

  /**
   * Remove an instance or schema document from a panel along with any associated mappings.
   * Display a confirmation dialog before removing the document definition.
   *
   * @param docDef
   * @param event
   */
  removeDocument(docDef: DocumentDefinition, event: any): void {
    if (event !== null) {
      event.stopPropagation();
    }
    this.modalWindow.reset();
    this.modalWindow.confirmButtonText = 'Remove';
    this.modalWindow.headerText = 'Remove selected document?';
    this.modalWindow.message = 'Are you sure you want to remove the selected document and any associated mappings?';
    this.modalWindow.okButtonHandler = async() => {
      this.cfg.mappings.removeDocumentReferenceFromAllMappings(docDef.id, this.cfg);
      if (docDef.isSource) {
        DataMapperUtil.removeItemFromArray(docDef, this.cfg.sourceDocs);
      } else {
        DataMapperUtil.removeItemFromArray(docDef, this.cfg.targetDocs);
      }
      await this.cfg.mappingService.notifyMappingUpdated();
      await this.cfg.fileService.exportMappingsCatalog(null);
    };
    this.modalWindow.show();
  }

  addField(docDef: DocumentDefinition, event: any): void {
    event.stopPropagation();
    this.getDocs().push(docDef);
    const self = this;
    this.modalWindow.reset();
    this.modalWindow.confirmButtonText = 'Save';
    const isProperty = docDef.type === DocumentType.PROPERTY;
    const isConstant = docDef.type === DocumentType.CONSTANT;
    this.modalWindow.headerText = isProperty ? 'Create Property' : (isConstant ? 'Create Constant' : 'Create Field');
    this.modalWindow.nestedComponentInitializedCallback = (mw: ModalWindowComponent) => {
      if (isProperty) {
        const propertyComponent = mw.nestedComponent as PropertyFieldEditComponent;
        propertyComponent.initialize(null, docDef, mw);
      } else if (isConstant) {
        const constantComponent = mw.nestedComponent as ConstantFieldEditComponent;
        constantComponent.initialize(null, docDef, mw);
      } else {
        const fieldComponent = mw.nestedComponent as FieldEditComponent;
        fieldComponent.isSource = this.isSource;
        fieldComponent.initialize(null, docDef, true);
      }
    };
    this.modalWindow.nestedComponentType = isProperty ? PropertyFieldEditComponent
      : (isConstant ? ConstantFieldEditComponent : FieldEditComponent);
    this.modalWindow.okButtonHandler = (mw: ModalWindowComponent) => {
      if (isProperty) {
        const propertyComponent = mw.nestedComponent as PropertyFieldEditComponent;
        propertyComponent.isClosing = true;
        docDef.addField(propertyComponent.getField());
      } else if (isConstant) {
        const constantComponent = mw.nestedComponent as ConstantFieldEditComponent;
        constantComponent.isClosing = true;
        docDef.addField(constantComponent.getField());
      } else {
        const fieldComponent = mw.nestedComponent as FieldEditComponent;
        docDef.addField(fieldComponent.getField());
      }
      self.cfg.mappingService.notifyMappingUpdated();
    };
    this.modalWindow.show();
  }

  isDocNameVisible(docDef: DocumentDefinition): boolean {
    if (this.searchMode && !docDef.visibleInCurrentDocumentSearch) {
      return false;
    }
    return true;
  }

  toggleFieldVisibility(docDef: DocumentDefinition): void {
    docDef.showFields = !docDef.showFields;
    this.redrawMappingLinesEvent.emit({_lmcInstance: this.lineMachine});
  }

  isAddFieldAvailable(docDef: DocumentDefinition): boolean {
    return docDef.isPropertyOrConstant;
    // https://github.com/atlasmap/atlasmap/issues/332
    //   || (!docDef.isSource && docDef.type == DocumentType.JSON)
    //   || (!docDef.isSource && docDef.type == DocumentType.XML);
  }

  /**
   * Callback function to track search box user input.
   *
   * @param event
   */
  selectionChanged(event: any): void {
    this.search(event.item['field']);
  }

  /**
   * The selectionChanged function is not called when going from one search character to none.  This function
   * however is called.
   *
   * @param event
   */
  selectionNoResults(event: any): void {
    if (!event) {
      this.search(this.searchFilter);
    }
  }

  /**
   * Mark all children of the specified field as visible and not collapsed.
   *
   * @param field
   */
  markChildrenVisible(field: Field): void {
    field.visibleInCurrentDocumentSearch = true;
    field.collapsed = false;
    if (this.searchFieldCount++ >= this.maxSearchMatch) {
      throw new Error('The maximum number of fields matching the specified search filter has beeen exceeded  ' +
        'Try using a longer field filter.');
    }
    for (const childField of field.children) {
      this.markChildrenVisible(childField);
    }
  }

  private search(searchFilter: string): any[] {
    const formattedFields: any[] = [];
    this.searchResultsExist = false;
    const searchIsEmpty: boolean = (searchFilter == null) || ('' === searchFilter);
    const defaultVisibility: boolean = searchIsEmpty ? true : false;
    for (const docDef of this.cfg.getDocs(this.isSource)) {
      docDef.visibleInCurrentDocumentSearch = defaultVisibility;
      for (const field of docDef.getAllFields()) {
        field.visibleInCurrentDocumentSearch = defaultVisibility;
      }
      if (!searchIsEmpty) {
        this.searchFieldCount = 0;
        for (const field of docDef.getAllFields()) {

          // Skip this field if it's already determined to be visible.
          if (field.visibleInCurrentDocumentSearch && !field.collapsed) {
            continue;
          }
          field.visibleInCurrentDocumentSearch = field.name.toLowerCase().includes(searchFilter.toLowerCase());
          this.searchResultsExist = this.searchResultsExist || field.visibleInCurrentDocumentSearch;

          // The current field matches the user-specified filter.
          if (field.visibleInCurrentDocumentSearch) {
            docDef.visibleInCurrentDocumentSearch = true;
            let parentField = field.parentField;

            // Direct lineage is then visible.
            while (parentField != null) {
              parentField.visibleInCurrentDocumentSearch = true;
              parentField.collapsed = false;
              parentField = parentField.parentField;
              this.searchFieldCount++;
            }

            // All fields below the matching field are also visible.
            try {
              this.markChildrenVisible(field);
            } catch (error) {
              this.cfg.errorService.info(error.message, null);
              break;
            }

            // The total number of matches is limited to allow the UI to perform.
            if (this.searchFieldCount++ >= this.maxSearchMatch) {
              this.cfg.errorService.info('The maximum number of fields matching the specified search filter has beeen exceeded  ' +
                'Try using a longer field filter.', null);
              break;
            }
          }
        }
      }
    }
    return formattedFields;  // required by typeahead - not used
  }
  valueExistsOnCreation(): boolean {
    return false;
  }
}
