import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function globalSetup(config: FullConfig) {
  // Create auth directory
  const authDir = path.join(__dirname, '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }
  
  // Check if baseURL is accessible
  const baseURL = config.projects[0].use?.baseURL || 'http://localhost:3000';
  console.log(`Testing against: ${baseURL}`);
  
  // Verify the server is running
  try {
    const response = await fetch(baseURL);
    console.log(`Server responded with status: ${response.status}`);
  } catch (error) {
    console.warn('Server not running, tests will start it via webServer config');
  }
}

export default globalSetup;
