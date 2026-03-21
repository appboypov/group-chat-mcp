import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { IDE } from '../enums/ide.js';
import { Scope } from '../enums/scope.js';

export class PromptUtils {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({ input: stdin, output: stdout });
  }

  async selectIDE(): Promise<IDE[]> {
    console.log('\nSelect target IDE:');
    console.log('  1) Claude Code');
    console.log('  2) Cursor');
    console.log('  3) Both');

    while (true) {
      const answer = await this.rl.question('\nChoice (1-3): ');
      switch (answer.trim()) {
        case '1': return [IDE.ClaudeCode];
        case '2': return [IDE.Cursor];
        case '3': return [IDE.ClaudeCode, IDE.Cursor];
        default:
          console.log('Invalid choice. Please enter 1, 2, or 3.');
      }
    }
  }

  async selectScope(): Promise<Scope> {
    console.log('\nSelect scope:');
    console.log('  1) Global (applies to all projects)');
    console.log('  2) Local (this project only)');

    while (true) {
      const answer = await this.rl.question('\nChoice (1-2): ');
      switch (answer.trim()) {
        case '1': return Scope.Global;
        case '2': return Scope.Local;
        default:
          console.log('Invalid choice. Please enter 1 or 2.');
      }
    }
  }

  async confirm(message: string): Promise<boolean> {
    const answer = await this.rl.question(`${message} (y/N): `);
    return answer.trim().toLowerCase() === 'y';
  }

  close(): void {
    this.rl.close();
  }
}
