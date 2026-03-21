import { IDE } from '../enums/ide.js';
import { Scope } from '../enums/scope.js';

export interface UninstallOptions {
  ide: IDE;
  scope: Scope;
}
