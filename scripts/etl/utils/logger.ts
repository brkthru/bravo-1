/**
 * Logger utility for ETL scripts with verbosity control
 */

export interface LoggerOptions {
  verbose: boolean;
  showTimestamps?: boolean;
}

export class ETLLogger {
  private verbose: boolean;
  private showTimestamps: boolean;
  private startTime: number;

  constructor(options: LoggerOptions) {
    this.verbose = options.verbose;
    this.showTimestamps = options.showTimestamps ?? false;
    this.startTime = Date.now();
  }

  private getTimestamp(): string {
    if (!this.showTimestamps) return '';
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    return `[${elapsed}s] `;
  }

  // Always show these
  error(message: string, error?: any): void {
    console.error(`${this.getTimestamp()}❌ ${message}`);
    if (error && this.verbose) {
      console.error('   Error details:', error);
    }
  }

  success(message: string): void {
    console.log(`${this.getTimestamp()}✅ ${message}`);
  }

  warning(message: string): void {
    console.log(`${this.getTimestamp()}⚠️  ${message}`);
  }

  info(message: string): void {
    console.log(`${this.getTimestamp()}📌 ${message}`);
  }

  // Only show in verbose mode
  debug(message: string): void {
    if (this.verbose) {
      console.log(`${this.getTimestamp()}   ${message}`);
    }
  }

  detail(message: string): void {
    if (this.verbose) {
      console.log(`${this.getTimestamp()}   - ${message}`);
    }
  }

  // Show summary in non-verbose, details in verbose
  summary(title: string, details: Record<string, any>): void {
    if (this.verbose) {
      console.log(`${this.getTimestamp()}${title}:`);
      Object.entries(details).forEach(([key, value]) => {
        console.log(`   - ${key}: ${value}`);
      });
    } else {
      // In concise mode, show as single line
      const summary = Object.entries(details)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      console.log(`${this.getTimestamp()}${title} (${summary})`);
    }
  }

  // Progress indicator for long operations
  progress(current: number, total: number, entity: string): void {
    if (this.verbose) {
      console.log(
        `   Processing ${entity}: ${current}/${total} (${Math.round((current / total) * 100)}%)`
      );
    }
  }

  // Section headers
  section(title: string): void {
    if (this.verbose) {
      console.log(`\n${this.getTimestamp()}${'='.repeat(50)}`);
      console.log(`${this.getTimestamp()}${title}`);
      console.log(`${this.getTimestamp()}${'='.repeat(50)}`);
    } else {
      console.log(`\n${this.getTimestamp()}${title}`);
    }
  }

  // Final summary with timing
  finalSummary(stats: Record<string, any>): void {
    const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log('\n📊 Pipeline Summary');
    console.log('==================');
    Object.entries(stats).forEach(([key, value]) => {
      console.log(`${key}: ${value}`);
    });
    console.log(`Total time: ${totalTime}s`);
  }
}
