/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { logger } from './Logger';
import { type LogEntry, type LogLevel, LOG_COLORS } from './types';
import './LogConsole.css';

export const LogConsole: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [consoleHeight, setConsoleHeight] = useState(30); // percentage of viewport height
  const [isDragging, setIsDragging] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [autocompleteMode, setAutocompleteMode] = useState<'command' | 'variable'>('command');
  const consoleRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const config = logger.getConfig();
  const maxHistorySize = 50;

  useEffect(() => {
    const unsubscribe = logger.subscribe(setLogs);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't toggle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === '`' || e.key === '~') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    // Focus the input when console opens
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isFullscreen) return;
    setIsDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const headerHeight = headerRef.current?.offsetHeight || 50;
      const minHeightVh = (headerHeight / window.innerHeight) * 100;
      const newHeight = ((window.innerHeight - e.clientY) / window.innerHeight) * 100;
      setConsoleHeight(Math.max(minHeightVh, Math.min(90, newHeight))); // Clamp between header height and 90%
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const formatData = (data: any, excludeStack = false): string => {
    if (data === undefined || data === null) return '';
    if (typeof data === 'string') return data;

    // Handle Error objects specially
    if (data instanceof Error) {
      const errorObj: any = {
        message: data.message,
        name: data.name
      };
      if (!excludeStack) {
        errorObj.stack = data.stack;
      }
      // Include any additional properties
      Object.keys(data).forEach(key => {
        if (!(key in errorObj)) {
          errorObj[key] = (data as any)[key];
        }
      });
      return JSON.stringify(errorObj, null, 2);
    }

    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  const syntaxHighlightJson = (json: string): React.ReactNode => {
    // Regular expressions for different JSON parts
    const patterns = [
      { regex: /"([^"\\]|\\.)*":/g, className: 'json-key' }, // Keys
      { regex: /"([^"\\]|\\.)*"(?=\s*[,}\]])/g, className: 'json-string' }, // String values
      { regex: /\b(true|false)\b/g, className: 'json-boolean' }, // Booleans
      { regex: /\bnull\b/g, className: 'json-null' }, // Null
      { regex: /\b-?\d+\.?\d*([eE][+-]?\d+)?\b/g, className: 'json-number' }, // Numbers
    ];

    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    const parts: Array<{ start: number; end: number; className: string; text: string }> = [];

    // Find all matches
    patterns.forEach(({ regex, className }) => {
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(json)) !== null) {
        parts.push({
          start: match.index,
          end: match.index + match[0].length,
          className,
          text: match[0]
        });
      }
    });

    // Sort by start position
    parts.sort((a, b) => a.start - b.start);

    // Remove overlapping parts (keep the first one)
    // Example issue: Timestamp: "2023-10-01T12:00:00Z" and "2023-10-01T12:00:00Z"
    const filteredParts: typeof parts = [];
    parts.forEach(part => {
      const lastPart = filteredParts[filteredParts.length - 1];
      if (!lastPart || part.start >= lastPart.end) {
        filteredParts.push(part);
      }
    });

    // Build the highlighted result
    filteredParts.forEach((part, index) => {
      // Add any text before this match
      if (part.start > lastIndex) {
        result.push(json.substring(lastIndex, part.start));
      }

      result.push(
        <span key={index} className={part.className}>
          {part.text}
        </span>
      );

      lastIndex = part.end;
    });

    if (lastIndex < json.length) {
      result.push(json.substring(lastIndex));
    }

    return result.length > 0 ? result : json;
  };

  const toggleErrorExpansion = (logId: string) => {
    setExpandedErrors(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const exportLogs = () => {
    const logData = logs.map(log => ({
      timestamp: log.timestamp.toISOString(),
      level: log.level,
      message: log.message,
      data: log.data,
      source: log.source
    }));

    const exportData = {
      exportDate: new Date().toISOString(),
      totalLogs: logs.length,
      logs: logData
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const input = commandInput.trim();

    // Add to history for both commands and expressions
    setCommandHistory(prev => {
      const newHistory = [input, ...prev.filter(cmd => cmd !== input)];
      return newHistory.slice(0, maxHistorySize);
    });
    setHistoryIndex(-1);

    if (input.startsWith('>')) {
      // Evaluate as JavaScript expression
      const expression = input.slice(1).trim();
      if (expression) {
        try {
          // Use Function constructor to avoid direct eval warnings
          // TODO! Maybe not ideal, consider fallback to eval if needed
          const result = new Function('return ' + expression)();
          logger.dev(`> ${expression}`, result);
        } catch (error) {
          logger.dev(`> ${expression}`, error);
        }
      }
      setCommandInput('');
      setShowAutocomplete(false);
      return;
    }

    // Special cases for common clear commands just for convenience
    if (input === 'clear' || input === 'cls') {
      logger.clear();
      setCommandInput('');
      setShowAutocomplete(false);
      return;
    }

    if (!input.startsWith('/')) {
      // TODO? Maybe prevent from sending
      logger.dev(`Invalid input. Use / for commands or > for JavaScript expressions.`);
      setCommandInput('');
      setShowAutocomplete(false);
      return;
    }


    // Resolve variables in the entire command
    const { resolved, unresolved } = logger.resolveVariables(input);

    if (unresolved.length > 0) {
      logger.dev(`Unresolved variables: ${unresolved.map(v => '${' + v + '}').join(', ')}`);
      setCommandInput('');
      setShowAutocomplete(false);
      return;
    }

    // Parse command with proper quote handling
    const parseCommandLine = (cmd: string): string[] => {
      const parts: string[] = [];
      let current = '';
      let inQuotes = false;
      let quoteChar = '';

      for (let i = 0; i < cmd.length; i++) {
        const char = cmd[i];

        if ((char === '"' || char === "'") && (i === 0 || cmd[i - 1] !== '\\')) {
          if (!inQuotes) {
            inQuotes = true;
            quoteChar = char;
          } else if (char === quoteChar) {
            inQuotes = false;
            quoteChar = '';
          } else {
            current += char;
          }
        } else if (char === ' ' && !inQuotes) {
          if (current) {
            parts.push(current);
            current = '';
          }
        } else {
          current += char;
        }
      }

      if (current) {
        parts.push(current);
      }

      return parts;
    };

    const allParts = parseCommandLine(resolved.slice(1));
    const commandName = allParts[0]?.toLowerCase() || '';
    const args = allParts.slice(1);

    setCommandInput('');
    setShowAutocomplete(false);

    switch (commandName) {
      case 'clear':
        logger.clear();
        break;

      case 'export':
        exportLogs();
        logger.dev(`Exported ${logs.length} logs to file`);
        break;

      case 'help':
        {
          const helpContent: { [key: string]: any } = {};
          helpContent['Core Commands'] = {
            '/clear': 'Clear all logs from the console',
            '/export': 'Export all logs to a JSON file',
            '/help': 'Show this help message',
            '/var': 'Variable management (list, set, get, delete)'
          };

          helpContent['Variable Commands'] = {
            '/var': 'List all defined variables',
            '/var set <name> <value>': 'Set a variable (auto-detects type)',
            '/var get <name>': 'Get a variable value',
            '/var delete <name>': 'Delete a variable',
            'Usage': 'Use ${varName} in any command to insert values'
          };

          helpContent['JavaScript Evaluation'] = {
            '> <expression>': 'Evaluate JavaScript expression',
            'Example': '> Math.random() * 100'
          };

          // Get registered commands and group by extension
          const commands = logger.getCommands();
          const commandsByExtension: { [key: string]: { [key: string]: string } } = {};

          Array.from(commands.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([name, cmd]) => {
              const prefix = name.split('.')[0];
              const extensionName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
              const section = `${extensionName} Extension`;

              if (!commandsByExtension[section]) {
                commandsByExtension[section] = {};
              }

              commandsByExtension[section][`/${name}`] = cmd.description || 'No description';
            });

          Object.entries(commandsByExtension).forEach(([section, cmds]) => {
            helpContent[section] = cmds;
          });

          helpContent['Tips'] = {
            'Autocomplete': 'Press Tab to autocomplete commands',
            'History': 'Use ↑/↓ arrows to navigate command history',
            'Quick Clear': 'Type "clear" or "cls" (without /) to clear logs',
            'Escape': 'Press Escape to close autocomplete menu'
          };

          logger.dev('DevConsole Help', helpContent);
          break;
        }

      case 'var':
        {
          if (args.length === 0 || (args.length === 1 && args[0] === 'list')) {
            // List all variables
            const variables = logger.getVariables();
            const varCount = Object.keys(variables).length;

            if (varCount === 0) {
              logger.dev('No variables defined');
            } else {
              let varList = `=== Variables (${varCount}) ===\n`;
              Object.entries(variables)
                .sort(([a], [b]) => a.localeCompare(b))
                .forEach(([name, value]) => {
                  varList += `${name} = ${JSON.stringify(value)}\n`;
                });
              logger.dev('Variables', varList.trimEnd());
            }
          } else if (args[0] === 'set' && args.length >= 3) {
            const varName = args[1];
            const varValue = args.slice(2).join(' ');

            // Try to parse as JSON first (for numbers and booleans)
            let parsedValue: string | number | boolean = varValue;
            try {
              parsedValue = JSON.parse(varValue);
            } catch {
              // If JSON parse fails, treat as string
              parsedValue = varValue;
            }

            logger.setVariable(varName, parsedValue);
            logger.dev(`Variable set: ${varName} = ${JSON.stringify(parsedValue)}`);
          } else if (args[0] === 'get' && args.length === 2) {
            const varName = args[1];
            const value = logger.getVariable(varName);

            if (value === undefined) {
              logger.dev(`Variable '${varName}' is not defined`);
            } else {
              logger.dev(`${varName} = ${JSON.stringify(value)}`);
            }
          } else if (args[0] === 'delete' && args.length === 2) {
            const varName = args[1];
            if (logger.deleteVariable(varName)) {
              logger.dev(`Variable '${varName}' deleted`);
            } else {
              logger.dev(`Variable '${varName}' not found`);
            }
          } else {
            logger.dev('Usage: /var [list|set <name> <value>|get <name>|delete <name>]');
          }
          break;
        }

      default:
        {
          const customCommand = logger.getCommand(commandName);
          if (customCommand) {
            try {
              customCommand.handler(args);
            } catch (error) {
              logger.dev(`Error executing command /${commandName}:`, error);
            }
          } else {
            logger.dev(`Unknown command: /${commandName}. Type /help for available commands.`);
          }
          break;
        }
    }
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getAllCommands = (): string[] => {
    const builtInCmds = ['clear', 'export', 'help', 'var'];
    const customCmds = Array.from(logger.getCommands().keys());
    return [...builtInCmds, ...customCmds].sort();
  };

  const getFilteredCommands = (input: string): string[] => {
    if (!input.startsWith('/')) return [];
    const search = input.slice(1).toLowerCase();

    // First, get exact matches (commands that start with the search term)
    const exactMatches = getAllCommands()
      .filter(cmd => cmd.toLowerCase().startsWith(search));

    // Then, get partial matches (commands that contain the search term but don't start with it)
    const partialMatches = getAllCommands()
      .filter(cmd => {
        const cmdLower = cmd.toLowerCase();
        return !cmdLower.startsWith(search) && cmdLower.includes(search);
      });

    // Combine results: exact matches first, then partial matches
    return [...exactMatches, ...partialMatches].map(cmd => `/${cmd}`);
  };

  const getFilteredVariables = (partialName: string): string[] => {
    const variables = logger.getVariables();
    const search = partialName.toLowerCase();

    return Object.keys(variables)
      .filter(varName => varName.toLowerCase().includes(search))
      .sort((a, b) => {
        // Exact matches first
        const aStarts = a.toLowerCase().startsWith(search);
        const bStarts = b.toLowerCase().startsWith(search);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCommandInput(value);
    setHistoryIndex(-1);

    // Check for variable autocomplete
    const lastDollarIndex = value.lastIndexOf('${');
    const lastCloseBraceIndex = value.lastIndexOf('}');

    if (lastDollarIndex > lastCloseBraceIndex && lastDollarIndex >= 0) {
      // We're inside a ${ } expression
      const partialVarName = value.substring(lastDollarIndex + 2);
      const filtered = getFilteredVariables(partialVarName);

      if (filtered.length > 0) {
        setAutocompleteMode('variable');
        setShowAutocomplete(true);
        setAutocompleteIndex(0);
      } else {
        setShowAutocomplete(false);
      }
    } else if (value === '/' || (value.startsWith('/') && value.length >= 1)) {
      // Command autocomplete
      const filtered = getFilteredCommands(value);
      if (filtered.length > 0) {
        setAutocompleteMode('command');
        setShowAutocomplete(true);
        setAutocompleteIndex(0);
      } else {
        setShowAutocomplete(false);
      }
    } else {
      setShowAutocomplete(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    let filtered: string[] = [];

    if (showAutocomplete) {
      if (autocompleteMode === 'command') {
        filtered = getFilteredCommands(commandInput);
      } else if (autocompleteMode === 'variable') {
        const lastDollarIndex = commandInput.lastIndexOf('${');
        const partialVarName = commandInput.substring(lastDollarIndex + 2);
        filtered = getFilteredVariables(partialVarName);
      }
    }

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (showAutocomplete && filtered.length > 0) {
          setAutocompleteIndex(prev =>
            prev > 0 ? prev - 1 : filtered.length - 1
          );
        } else if (commandHistory.length > 0) {
          const newIndex = historyIndex + 1;
          if (newIndex < commandHistory.length) {
            setHistoryIndex(newIndex);
            setCommandInput(commandHistory[newIndex]);
            setShowAutocomplete(false);
          }
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (showAutocomplete && filtered.length > 0) {
          setAutocompleteIndex(prev =>
            prev < filtered.length - 1 ? prev + 1 : 0
          );
        } else if (historyIndex > -1) {
          const newIndex = historyIndex - 1;
          if (newIndex >= 0) {
            setHistoryIndex(newIndex);
            setCommandInput(commandHistory[newIndex]);
          } else {
            setHistoryIndex(-1);
            setCommandInput('');
          }
          setShowAutocomplete(false);
        }
        break;

      case 'Tab':
        if (showAutocomplete && filtered.length > 0) {
          e.preventDefault();

          if (autocompleteMode === 'command') {
            setCommandInput(filtered[autocompleteIndex] + ' ');
          } else if (autocompleteMode === 'variable') {
            // Replace the partial variable with the complete one
            const lastDollarIndex = commandInput.lastIndexOf('${');
            const beforeVar = commandInput.substring(0, lastDollarIndex);
            const selectedVar = filtered[autocompleteIndex];
            setCommandInput(beforeVar + '${' + selectedVar + '}');
          }

          setShowAutocomplete(false);
        }
        break;

      case 'Escape':
        if (showAutocomplete) {
          e.preventDefault();
          setShowAutocomplete(false);
        }
        break;
    }
  };

  const filteredLogs = logs.filter(log => {
    // Level filter
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;

    // Text filter
    if (!filter) return true;
    const searchText = filter.toLowerCase();
    return (
      log.message.toLowerCase().includes(searchText) ||
      log.level.toLowerCase().includes(searchText) ||
      formatData(log.data).toLowerCase().includes(searchText) ||
      (log.source?.file.toLowerCase().includes(searchText) ?? false)
    );
  });

  if (!isOpen) return null;

  return (
    <div
      className={`log-console ${isFullscreen ? 'fullscreen' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{ height: isFullscreen ? '100vh' : `${consoleHeight}vh` }}
    >
      <div className="log-console-drag-handle" onMouseDown={handleMouseDown} />
      <div
        ref={headerRef}
        className="log-console-header"
      >
        <h3>
          Developer Console [{logs.length}/{config.maxLogs}]
          {(filter || levelFilter !== 'all') && (
            <span className="filtered-count"> - Showing {filteredLogs.length}</span>
          )}
        </h3>
        <div className="log-console-controls">
          <select
            className="log-console-level-filter"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as LogLevel | 'all')}
          >
            <option value="all">All Levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="dev">Dev</option>
          </select>
          <input
            type="text"
            className="log-console-filter"
            placeholder="Filter by text or filename..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button onClick={() => logger.clear()}>Clear</button>
          <button onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
            {isFullscreen ? 'B' : 'F'}
          </button>
          <button onClick={() => setIsOpen(false)}>X</button>
        </div>
      </div>
      <div className="log-console-body" ref={consoleRef}>
        {filteredLogs.map((log) => (
          <div
            key={log.id}
            className={`log-entry log-${log.level}`}
            style={{ borderLeftColor: LOG_COLORS[log.level] }}
          >
            <div className="log-entry-header">
              <span className="log-time">{formatTime(log.timestamp)}</span>
              <span className="log-level" style={{ color: LOG_COLORS[log.level] }}>
                [{log.level.toUpperCase()}]
              </span>
              {log.source && (
                <span className="log-source">
                  {log.source.file}:{log.source.line}:{log.source.column}
                </span>
              )}
            </div>
            <div className="log-message">{log.message}</div>
            {log.data !== undefined && (
              <>
                <div className="log-data-container">
                  {log.data instanceof Error ? (
                    <>
                      <pre className="log-data">{syntaxHighlightJson(formatData(log.data, true))}</pre>
                      <div
                        className="copy-button"
                        onClick={() => navigator.clipboard.writeText(formatData(log.data, true))}
                        title="Copy data"
                      >
                        ⧉
                      </div>
                      <div className="error-stack-section">
                        <button
                          className="error-stack-toggle"
                          onClick={() => toggleErrorExpansion(log.id)}
                        >
                          {expandedErrors.has(log.id) ? '⮵' : '⮷'} Stack Trace
                        </button>
                        {expandedErrors.has(log.id) && (
                          <pre className="error-stack">{log.data.stack}</pre>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <pre className="log-data">
                        {typeof log.data === 'string' ? log.data : syntaxHighlightJson(formatData(log.data))}
                      </pre>
                      <div
                        className="copy-button"
                        onClick={() => navigator.clipboard.writeText(formatData(log.data))}
                        title="Copy data"
                      >
                        ⧉
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="log-console-input-wrapper">
        {showAutocomplete && (
          <div className="log-console-autocomplete">
            {(() => {
              if (autocompleteMode === 'command') {
                return getFilteredCommands(commandInput).map((cmd, index) => (
                  <div
                    key={cmd}
                    className={`autocomplete-item ${index === autocompleteIndex ? 'selected' : ''}`}
                    onClick={() => {
                      setCommandInput(cmd + ' ');
                      setShowAutocomplete(false);
                      inputRef.current?.focus();
                    }}
                  >
                    {cmd}
                  </div>
                ));
              } else if (autocompleteMode === 'variable') {
                const lastDollarIndex = commandInput.lastIndexOf('${');
                const partialVarName = commandInput.substring(lastDollarIndex + 2);
                const beforeVar = commandInput.substring(0, lastDollarIndex);

                return getFilteredVariables(partialVarName).map((varName, index) => {
                  const variables = logger.getVariables();
                  const value = variables[varName];

                  return (
                    <div
                      key={varName}
                      className={`autocomplete-item ${index === autocompleteIndex ? 'selected' : ''}`}
                      onClick={() => {
                        setCommandInput(beforeVar + '${' + varName + '}');
                        setShowAutocomplete(false);
                        inputRef.current?.focus();
                      }}
                    >
                      <span style={{ color: '#9CDCFE' }}>${varName}</span>
                      <span style={{ color: '#666', marginLeft: '8px' }}>= {JSON.stringify(value)}</span>
                    </div>
                  );
                });
              }
              return null;
            })()}
          </div>
        )}
        <form onSubmit={handleCommand} className="log-console-input-container">
          <input
            ref={inputRef}
            type="text"
            className="log-console-input"
            value={commandInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type /help for commands or > for JS expressions..."
          />
        </form>
      </div>
    </div>
  );
};