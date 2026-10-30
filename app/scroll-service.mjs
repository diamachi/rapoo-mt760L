import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateLines } from './src/scroll.mjs';
export class ScrollService {
  child = null; lines = null;
  status() { return { running: Boolean(this.child), lines: this.lines, scope: 'all-hid-mouse-wheels', trackpadUnchanged: true, source:'raw-hid-wheel-counts' }; }
  async stop() {
    const child=this.child; this.child=null; this.lines=null;
    if(child&&child.exitCode===null&&child.signalCode===null) await new Promise(resolve=>{child.once('close',resolve); child.kill('SIGTERM');});
    return this.status();
  }
  async start(lines) {
    validateLines(lines); await this.stop();
    const child=spawn(process.execPath,['--experimental-ffi',fileURLToPath(new URL('./native/macos-scroll.mjs',import.meta.url)),String(lines)],{stdio:['ignore','pipe','pipe']});
    this.child=child;
    const cleanup=()=>{if(this.child===child){this.child=null;this.lines=null;}};
    child.once('exit',cleanup);
    try {
      await new Promise((resolve,reject)=>{
        let output='', errors='';
        const timeout=setTimeout(()=>finish(Error('Scroll helper did not start')),5000);
        const failed=()=>finish(Error(errors || 'Scroll helper stopped before it was ready'));
        const finish=error=>{clearTimeout(timeout);child.removeListener('exit',failed);error?reject(error):resolve();};
        child.once('error',finish);child.once('exit',failed);
        child.stderr.on('data',b=>{errors=(errors+b.toString()).slice(-2000);});
        child.stdout.on('data',b=>{
          output+=b.toString();if(!output.includes('\n'))return;
          try {const result=JSON.parse(output.split('\n')[0]);if(result.error)finish(Error(result.error));else if(result.running)finish();}catch(error){finish(error);}
        });
      });
      this.lines=lines;return this.status();
    } catch(error){await this.stop();throw error;}
  }
}
