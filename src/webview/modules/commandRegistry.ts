export interface Command {
  id: string;
  group: 'mode' | 'history' | 'viewport' | 'view' | 'document' | 'settings' | 'menu';
  icon?: string;
  title?: string;
  execute: (args?: any) => void;
}

export class CommandRegistry {
  private commands = new Map<string, Command>();

  register(cmd: Command) {
    this.commands.set(cmd.id, cmd);
  }

  execute(id: string, args?: any) {
    const cmd = this.commands.get(id);
    if (cmd) {
      try {
        cmd.execute(args);
      } catch (err: any) {
        console.error(`[CommandRegistry] Error executing command '${id}':`, err);
        if (typeof (window as any).showError === 'function') {
          (window as any).showError(`Command '${id}' failed: ${err.message}`);
        }
      }
    } else {
      console.warn(`[CommandRegistry] Command '${id}' not found.`);
    }
  }

  get(id: string) {
    return this.commands.get(id);
  }
}

export const commandRegistry = new CommandRegistry();
