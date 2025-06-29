#!/usr/bin/env node

/**
 * Unified Test Runner for MagicNetwork
 * Runs different categories of tests with proper reporting
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test categories and their files
const TEST_CATEGORIES = {
  'backend-api': [
    'api-endpoints.test.js',
    'comprehensive-api.test.js'
  ],
  'backend-database': [
    'database-validation.test.js',
    'data-import.test.js'
  ],
  'integration': [
    'filter-integration.test.js',
    'e2e.test.js'
  ],
  'full-stack': [
    'full-stack.test.sh'
  ],
  'validation': [
    'card-validation.test.sh'
  ]
};

class TestRunner {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      categories: {}
    };
    this.startTime = Date.now();
  }

  async runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        stdio: 'pipe',
        ...options
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
        if (options.verbose) {
          process.stdout.write(data);
        }
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
        if (options.verbose) {
          process.stderr.write(data);
        }
      });

      proc.on('close', (code) => {
        resolve({
          code,
          stdout,
          stderr,
          success: code === 0
        });
      });

      proc.on('error', reject);
    });
  }

  async runTestFile(filePath, category) {
    console.log(`\n🧪 Running ${filePath}...`);
    
    this.results.total++;
    const testStart = Date.now();

    try {
      let result;
      
      if (filePath.endsWith('.sh')) {
        // Shell script
        result = await this.runCommand('bash', [join(__dirname, filePath)], {
          cwd: join(__dirname, '..'),
          verbose: false
        });
      } else {
        // Node.js script
        result = await this.runCommand('node', [join(__dirname, filePath)], {
          cwd: join(__dirname, '..'),
          verbose: false
        });
      }

      const duration = Date.now() - testStart;
      
      if (result.success) {
        console.log(`✅ ${filePath} passed (${duration}ms)`);
        this.results.passed++;
        this.results.categories[category] = this.results.categories[category] || { passed: 0, failed: 0 };
        this.results.categories[category].passed++;
      } else {
        console.log(`❌ ${filePath} failed (${duration}ms)`);
        console.log(`   Error: ${result.stderr || result.stdout}`);
        this.results.failed++;
        this.results.categories[category] = this.results.categories[category] || { passed: 0, failed: 0 };
        this.results.categories[category].failed++;
      }

      return result;
    } catch (error) {
      console.log(`💥 ${filePath} crashed: ${error.message}`);
      this.results.failed++;
      this.results.categories[category] = this.results.categories[category] || { passed: 0, failed: 0 };
      this.results.categories[category].failed++;
      return { success: false, error };
    }
  }

  async runCategory(categoryName, testFiles) {
    console.log(`\n📂 Running ${categoryName} tests...`);
    
    for (const testFile of testFiles) {
      await this.runTestFile(testFile, categoryName);
    }
  }

  generateReport() {
    const duration = Date.now() - this.startTime;
    
    const report = `
# Test Report - ${new Date().toISOString()}

## Summary
- **Total Tests**: ${this.results.total}
- **Passed**: ${this.results.passed}
- **Failed**: ${this.results.failed}
- **Success Rate**: ${this.results.total > 0 ? Math.round((this.results.passed / this.results.total) * 100) : 0}%
- **Duration**: ${duration}ms

## Categories
${Object.entries(this.results.categories).map(([category, stats]) => 
  `- **${category}**: ${stats.passed} passed, ${stats.failed} failed`
).join('\n')}

## Status
${this.results.failed === 0 ? '🎉 All tests passed!' : `⚠️ ${this.results.failed} test(s) failed`}
`;

    writeFileSync(join(__dirname, 'test-report.md'), report);
    console.log('\n' + report);
    
    return this.results.failed === 0;
  }

  async run(categories = null) {
    console.log('🚀 MagicNetwork Test Runner Starting...\n');

    const categoriesToRun = categories || Object.keys(TEST_CATEGORIES);

    for (const categoryName of categoriesToRun) {
      if (TEST_CATEGORIES[categoryName]) {
        await this.runCategory(categoryName, TEST_CATEGORIES[categoryName]);
      } else {
        console.log(`⚠️ Unknown test category: ${categoryName}`);
      }
    }

    const success = this.generateReport();
    process.exit(success ? 0 : 1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const categories = args.length > 0 ? args : null;

// Run tests
const runner = new TestRunner();
runner.run(categories).catch(console.error);