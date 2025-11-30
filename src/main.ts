import { ParserFactory, Language } from './parsers/ParserFactory.js';
import { CanvasRenderer } from './generators/CanvasRenderer.js';

class ClassDiagramApp {
  private parserFactory: ParserFactory;
  private canvasRenderer: CanvasRenderer | null = null;
  private files: Array<{ name: string; content: string }> = [];
  
  private fileInput: HTMLInputElement;
  private fileList: HTMLElement;
  private languageSelect: HTMLSelectElement;
  private generateBtn: HTMLButtonElement;
  private clearBtn: HTMLButtonElement;
  private diagramSection: HTMLElement;
  private diagramCanvas: HTMLCanvasElement;
  private errorSection: HTMLElement;
  private errorMessage: HTMLElement;
  private exportSvgBtn: HTMLButtonElement;
  private exportPngBtn: HTMLButtonElement;

  constructor() {
    this.parserFactory = new ParserFactory();
    
    this.fileInput = document.getElementById('file-input') as HTMLInputElement;
    this.fileList = document.getElementById('file-list') as HTMLElement;
    this.languageSelect = document.getElementById('language-select') as HTMLSelectElement;
    this.generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
    this.clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
    this.diagramSection = document.getElementById('diagram-section') as HTMLElement;
    this.diagramCanvas = document.getElementById('diagram-canvas') as HTMLCanvasElement;
    this.errorSection = document.getElementById('error-section') as HTMLElement;
    this.errorMessage = document.getElementById('error-message') as HTMLElement;
    this.exportSvgBtn = document.getElementById('export-svg') as HTMLButtonElement;
    this.exportPngBtn = document.getElementById('export-png') as HTMLButtonElement;
    
    this.initialize();
  }

  private initialize(): void {
    this.canvasRenderer = new CanvasRenderer(this.diagramCanvas);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    
    const fileLabel = document.querySelector('.file-label') as HTMLElement;
    fileLabel.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileLabel.style.borderColor = '#764ba2';
      fileLabel.style.background = '#f0f2ff';
    });
    
    fileLabel.addEventListener('dragleave', () => {
      fileLabel.style.borderColor = '#667eea';
      fileLabel.style.background = '#f8f9ff';
    });
    
    fileLabel.addEventListener('drop', (e) => {
      e.preventDefault();
      fileLabel.style.borderColor = '#667eea';
      fileLabel.style.background = '#f8f9ff';
      
      if (e.dataTransfer?.files) {
        this.processFiles(Array.from(e.dataTransfer.files));
      }
    });
    
    this.generateBtn.addEventListener('click', () => this.generateDiagram());
    this.clearBtn.addEventListener('click', () => this.clearAll());
    this.exportSvgBtn.addEventListener('click', () => this.exportSVG());
    this.exportPngBtn.addEventListener('click', () => this.exportPNG());
  }

  private handleFileSelect(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.processFiles(Array.from(target.files));
    }
  }

  private async processFiles(fileList: File[]): Promise<void> {
    for (const file of fileList) {
      try {
        const content = await this.readFileContent(file);
        this.files.push({ name: file.name, content });
        this.addFileToList(file.name);
      } catch (error) {
        this.showError(`Error reading file ${file.name}: ${error}`);
      }
    }
    
    this.updateGenerateButton();
  }

  private readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  private addFileToList(fileName: string): void {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    
    const fileIcon = document.createElement('div');
    fileIcon.className = 'file-icon';
    const extension = fileName.split('.').pop()?.toUpperCase() || '?';
    fileIcon.textContent = extension;
    
    const fileNameSpan = document.createElement('span');
    fileNameSpan.className = 'file-name';
    fileNameSpan.textContent = fileName;
    
    fileInfo.appendChild(fileIcon);
    fileInfo.appendChild(fileNameSpan);
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'file-remove';
    removeBtn.innerHTML = '✕';
    removeBtn.onclick = () => this.removeFile(fileName);
    
    fileItem.appendChild(fileInfo);
    fileItem.appendChild(removeBtn);
    
    this.fileList.appendChild(fileItem);
  }

  private removeFile(fileName: string): void {
    this.files = this.files.filter(f => f.name !== fileName);
    this.updateFileList();
    this.updateGenerateButton();
  }

  private updateFileList(): void {
    this.fileList.innerHTML = '';
    this.files.forEach(file => this.addFileToList(file.name));
  }

  private updateGenerateButton(): void {
    this.generateBtn.disabled = this.files.length === 0;
  }

  private generateDiagram(): void {
    try {
      this.hideError();
      
      if (this.files.length === 0) {
        this.showError('Please upload at least one file');
        return;
      }
      
      const selectedLanguage = this.languageSelect.value as Language;
      
      const diagram = this.parserFactory.parseMultipleFiles(this.files, selectedLanguage);
      
      diagram.inheritMembersFromParents();
      
      const classes = diagram.getClasses();
      console.log(`Classes found: ${classes.length}`);
      
      if (classes.length === 0) {
        this.showError('No classes or interfaces found in uploaded files');
        return;
      }
      
      classes.forEach(cls => {
        const type = cls.isInterface ? 'interface' : cls.isAbstract ? 'abstract class' : 'class';
        console.log(`Class: ${cls.name}, Type: ${type}, Fields: ${cls.fields.length}, Methods: ${cls.methods.length}`);
      });
      
      const relationships = diagram.getRelationships();
      console.log(`Relationships found: ${relationships.length}`);
      relationships.forEach(rel => {
        console.log(`  ${rel.from} → ${rel.to} (${rel.type})`);
      });

      if (this.canvasRenderer) {
        this.canvasRenderer.render(diagram);
        console.log('Diagram successfully rendered on canvas');
      }

      this.diagramSection.classList.remove('hidden');

      this.diagramSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
    } catch (error) {
      console.error('Diagram generation error:', error);
      this.showError(`Error generating diagram: ${error}`);
    }
  }

  private clearAll(): void {
    this.files = [];
    this.fileList.innerHTML = '';
    this.fileInput.value = '';
    this.diagramSection.classList.add('hidden');
    
    if (this.canvasRenderer) {
      const ctx = this.diagramCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, this.diagramCanvas.width, this.diagramCanvas.height);
      }
    }
    
    this.hideError();
    this.updateGenerateButton();
  }

  private showError(message: string): void {
    this.errorMessage.textContent = message;
    this.errorSection.classList.remove('hidden');
  }

  private hideError(): void {
    this.errorSection.classList.add('hidden');
  }

  private exportSVG(): void {
    try {
      if (!this.canvasRenderer) {
        this.showError('Diagram not yet generated');
        return;
      }
      
      const svgContent = this.canvasRenderer.exportToSVG();
      this.downloadFile(svgContent, 'class-diagram.svg', 'image/svg+xml');
    } catch (error) {
      this.showError(`Error exporting SVG: ${error}`);
    }
  }

  private async exportPNG(): Promise<void> {
    try {
      if (!this.canvasRenderer) {
        this.showError('Diagram not yet generated');
        return;
      }
      
      const pngBlob = await this.canvasRenderer.exportToPNG();
      if (!pngBlob) {
        throw new Error('Failed to create PNG');
      }
      
      const url = URL.createObjectURL(pngBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = 'class-diagram.png';
      link.click();
      
      URL.revokeObjectURL(url);
    } catch (error) {
      this.showError(`Error exporting PNG: ${error}`);
    }
  }

  private downloadFile(content: string, fileName: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    
    URL.revokeObjectURL(url);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ClassDiagramApp();
});
