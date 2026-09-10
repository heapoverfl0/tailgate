# Limited-use runtime with known dependency findings; see docs/dependency-review.md.
# Requires an already downloaded pinned image, Docker, Python 3, and JDK 17+.
# No images are pulled and no host directories or credentials enter the container.
import subprocess,uuid,json,time,socket,os,sys,tempfile,pathlib,socketserver,threading
image='amazon/dynamodb-local@sha256:ff89bd48ff32cd8d9be5fee8873b65b8854dc408f1afe881be6eb00247bc0dab'
name='tailgate-test-'+uuid.uuid4().hex[:12]
container=None;server=None;relays=[]
with tempfile.TemporaryDirectory(prefix='tailgate-relay-') as directory:
 source=pathlib.Path(directory)/'TailgateRelay.java'
 source.write_text('''import java.net.Socket;
public class TailgateRelay {
 public static void main(String[] args) throws Exception {
  try(Socket socket = new Socket("127.0.0.1", 8000)) {
   Thread input = new Thread(() -> { try { System.in.transferTo(socket.getOutputStream()); socket.shutdownOutput(); } catch(Exception e) {} });
   input.setDaemon(true); input.start();
   socket.getInputStream().transferTo(System.out); System.out.flush();
  }
 }
}''')
 subprocess.run(['javac','--release','17',str(source)],check=True)
 try:
  container=subprocess.check_output(['docker','run','-d','--pull=never','--name',name,'--network','none','--hostname','localhost','--read-only','--tmpfs','/tmp:rw,exec,nosuid,nodev,size=128m','--cap-drop=ALL','--security-opt','no-new-privileges:true','--memory=512m','--cpus=1',image,'-Djava.library.path=./DynamoDBLocal_lib','-jar','DynamoDBLocal.jar','-inMemory','-sharedDb'],text=True).strip()
  subprocess.run(['docker','exec','-i',container,'sh','-c','cat > /tmp/TailgateRelay.class'],input=(pathlib.Path(directory)/'TailgateRelay.class').read_bytes(),check=True)
  info=json.loads(subprocess.check_output(['docker','inspect',container]))[0]
  assert info['HostConfig']['NetworkMode']=='none' and not info['Mounts'] and info['HostConfig']['ReadonlyRootfs']
  print('Isolation:',json.dumps({'network':'none','readOnly':True,'user':info['Config']['User'],'hostMounts':info['Mounts'],'capDrop':info['HostConfig']['CapDrop']}),flush=True)
  time.sleep(5)
  class Handler(socketserver.BaseRequestHandler):
   def handle(self):
    p=subprocess.Popen(['docker','exec','-i',container,'java','-cp','/tmp','TailgateRelay'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
    relays.append(p)
    def upload():
     try:
      while True:
       data=self.request.recv(65536)
       if not data:break
       p.stdin.write(data);p.stdin.flush()
     except (OSError,ValueError):pass
     finally:
      try:p.stdin.close()
      except OSError:pass
    threading.Thread(target=upload,daemon=True).start()
    try:
     while True:
      data=os.read(p.stdout.fileno(),65536)
      if not data:break
      self.request.sendall(data)
    except OSError:pass
    finally:p.terminate();p.wait(timeout=5)
  class Server(socketserver.ThreadingTCPServer):daemon_threads=True
  server=Server(('127.0.0.1',0),Handler)
  threading.Thread(target=server.serve_forever,daemon=True).start()
  env=os.environ.copy();env['TAILGATE_DYNAMO_TEST_ENDPOINT']='http://127.0.0.1:'+str(server.server_address[1])
  print('Running tests through loopback stdio relay:',env['TAILGATE_DYNAMO_TEST_ENDPOINT'],flush=True)
  result=subprocess.run(['npm','run','test:integration'],cwd=pathlib.Path(__file__).resolve().parents[1],env=env,timeout=150)
  if result.returncode:subprocess.run(['docker','logs','--tail','160',container])
  sys.exit(result.returncode)
 finally:
  if server:server.shutdown();server.server_close()
  for p in relays:
   if p.poll() is None:p.terminate()
  if container:subprocess.run(['docker','rm','-f',container],check=True,stdout=subprocess.DEVNULL)
  print('Removed test container and closed relay. No network was created.',flush=True)
