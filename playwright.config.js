import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests',testMatch:'*.spec.js',workers:1,fullyParallel:false,
 use:{baseURL:'http://127.0.0.1:18080',headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined},
 webServer:[
  {command:'node tests/support/supabase.mjs',url:'http://127.0.0.1:54329/health',timeout:30000,reuseExistingServer:false},
  {command:'java -jar target/stockflow-1.0.0.jar',url:'http://127.0.0.1:18080',timeout:60000,reuseExistingServer:false,env:{SUPABASE_URL:'http://127.0.0.1:54329',SUPABASE_ANON_KEY:'test-only-key',PORT:'18080',COOKIE_SECURE:'false'}}
 ]
});
