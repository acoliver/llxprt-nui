import { createContext, useCallback, useContext, useMemo, useRef, useState, type JSX, type ReactNode } from "react";

interface DialogContextValue {
  readonly replace: (element: JSX.Element) => void;
  readonly clear: () => void;
  readonly isOpen: boolean;
}

interface Command {
  readonly name: string;
  readonly title: string;
  readonly category?: string;
  readonly onExecute: (dialog: DialogContextValue) => void | Promise<void>;
}

interface CommandContextValue {
  readonly register: (commands: Command[]) => () => void;
  readonly trigger: (name: string) => Promise<boolean>;
  readonly getCommands: () => Command[];
}

const CommandContext = createContext<CommandContextValue | null>(null);

export function useCommand(): CommandContextValue {
  const context = useContext(CommandContext);
  if (context === null) {
    throw new Error("useCommand must be used within CommandProvider");
  }
  return context;
}

interface CommandProviderProps {
  readonly children: ReactNode;
  readonly dialogContext: DialogContextValue;
}

let registrationId = 0;

export function CommandProvider({ children, dialogContext }: CommandProviderProps): JSX.Element {
  const [commands, setCommands] = useState<Map<string, Command>>(new Map());
  const mountedComponents = useRef(new Set<number>());

  const register = useCallback((newCommands: Command[]) => {
    registrationId += 1;
    const componentId = registrationId;
    mountedComponents.current.add(componentId);

    setCommands((prev) => {
      const next = new Map(prev);
      for (const command of newCommands) {
        next.set(command.name, command);
      }
      return next;
    });

    return () => {
      mountedComponents.current.delete(componentId);
      setCommands((prev) => {
        const next = new Map(prev);
        for (const command of newCommands) {
          next.delete(command.name);
        }
        return next;
      });
    };
  }, []);

  const trigger = useCallback(
    async (name: string): Promise<boolean> => {
      const command = commands.get(name);
      if (command === undefined) {
        return false;
      }
      await command.onExecute(dialogContext);
      return true;
    },
    [commands, dialogContext]
  );

  const getCommands = useCallback((): Command[] => {
    return Array.from(commands.values());
  }, [commands]);

  const contextValue = useMemo(
    () => ({ register, trigger, getCommands }),
    [register, trigger, getCommands]
  );

  return (
    <CommandContext.Provider value={contextValue}>
      {children}
    </CommandContext.Provider>
  );
}

export type { Command };
