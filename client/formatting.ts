import * as vscode from "vscode";
import * as child_process from "child_process";

let formattingProvider: vscode.Disposable | undefined;

export function activate(context: vscode.ExtensionContext) {
  const fmtExecutablePath = vscode.workspace.getConfiguration("jsonnet")[
    "fmtExecutablePath"
  ] as string | undefined;

  const fmtOptionsStr = vscode.workspace.getConfiguration("jsonnet")[
    "fmtOptions"
  ] as string;

  const formatter = new ExternalProcessJsonnetFormatter(fmtExecutablePath, fmtOptionsStr);

  formattingProvider = vscode.languages.registerDocumentFormattingEditProvider(
    "jsonnet",
    new JsonnetDocumentFormattingProvider(formatter)
  );
}

export function deactivate() {
  formattingProvider?.dispose();
  formattingProvider = undefined;
}

interface JsonnetFormatter {
  format(text: string): Promise<string>;
}

class JsonnetDocumentFormattingProvider
  implements vscode.DocumentFormattingEditProvider {
  constructor(private formatter: JsonnetFormatter) { }

  async provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions,
    token: vscode.CancellationToken
  ): Promise<vscode.TextEdit[]> {
    try {
      const text = document.getText();

      const formattedText = await this.formatter.format(text);

      return [
        vscode.TextEdit.replace(
          new vscode.Range(
            new vscode.Position(0, 0),
            new vscode.Position(document.lineCount, 0)
          ),
          formattedText
        ),
      ];
    } catch (e) {
      vscode.window.showErrorMessage(`Formatting error: ${e.message}`);
      return [];
    }
  }
}

class ExternalProcessJsonnetFormatter implements JsonnetFormatter {
  constructor(private binaryPath: string | undefined, private fmtOptionsStr: string) { }

  async format(text: string): Promise<string> {
    var fmtOptions: string[] = this.fmtOptionsStr == '' ? [] : this.fmtOptionsStr.split(" ")
    const result = child_process.spawnSync(
      this.binaryPath ?? "jsonnetfmt",
      [...fmtOptions, '-'],
      {
        shell: true,
        input: text,
      }
    );

    if (result.status !== 0) {
      const err = result.stdout.toLocaleString()
      throw new Error(`Invalid exit status ${result.status} \n${err}`);
    }

    if (result.error) {
      throw result.error;
    }

    return result.stdout.toLocaleString();
  }
}
