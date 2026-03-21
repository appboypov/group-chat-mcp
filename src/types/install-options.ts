import { IDE } from '../enums/ide.js';
import { Scope } from '../enums/scope.js';

export interface InstallOptions {
  ide: IDE;
  scope: Scope;
}
