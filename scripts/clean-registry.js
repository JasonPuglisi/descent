// Deletes image layers in the App Engine image repository that no image uses
// anymore. The repository's cleanup policy deletes old images, but Artifact
// Registry keeps their layers, and they had piled up to 7 GB against a free
// tier of 0.5 GB before anyone noticed. The deploy workflow runs this after
// each deploy.
//
//   ACCESS_TOKEN   OAuth token that can list and delete in the repository
//   REPOSITORY     projects/<project>/locations/<location>/repositories/<name>
//   DRY_RUN        set to anything to only report what would go
//
// It stops without deleting anything if it can't read every image, since a
// layer missing from the referenced set would look unused.

let api = 'https://artifactregistry.googleapis.com/v1';

// Layers younger than this might belong to a build still uploading
let minimumAge = 24 * 60 * 60 * 1000;

let manifestTypes = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.docker.distribution.manifest.v2+json'
].join(', ');

// The pure part: which files to delete, given every file in the repository and
// every digest an image refers to
export function findUnused(files, referenced, now, minAge = minimumAge) {
  return files.filter(file => {
    // Manifests belong to an image version and go when it does
    if (file.owner)
      return false;

    let digest = file.hashes?.find(hash => hash.type === 'SHA256')?.value;

    if (!digest || referenced.has(`sha256:${digest}`))
      return false;

    return now - Date.parse(file.createTime) >= minAge;
  });
}

async function request(url, token, options = {}) {
  let response = await fetch(url, {
    ...options,
    'headers': { 'Authorization': `Bearer ${token}`, ...options.headers },
    'signal': AbortSignal.timeout(30000)
  });

  if (!response.ok)
    throw new Error(`${options.method || 'GET'} ${url}: ${response.status} ${(await response.text()).slice(0, 200)}`);

  return response.json();
}

async function listAll(url, token, key) {
  let items = [];
  let pageToken = '';

  do {
    let page = await request(`${url}?pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`, token);
    items.push(...(page[key] || []));
    pageToken = page.nextPageToken || '';
  } while (pageToken);

  return items;
}

// Every layer, config and child manifest an image refers to, following indexes
// down to the platform manifests inside them
async function collectReferences(registry, digest, token, referenced) {
  referenced.add(digest);

  let manifest = await request(`${registry}/manifests/${digest}`, token, { 'headers': { 'Accept': manifestTypes } });

  for (let child of manifest.manifests || [])
    await collectReferences(registry, child.digest, token, referenced);

  for (let blob of [manifest.config, ...(manifest.layers || [])])
    if (blob?.digest)
      referenced.add(blob.digest);
}

async function main() {
  let token = process.env.ACCESS_TOKEN;
  let repository = process.env.REPOSITORY;
  let dryRun = Boolean(process.env.DRY_RUN);

  let [, project, , location, , name] = repository.split('/');
  let host = `https://${location}-docker.pkg.dev/v2/${project}/${name}`;

  let images = await listAll(`${api}/${repository}/dockerImages`, token, 'dockerImages');
  let referenced = new Set();

  for (let image of images) {
    // uri is <host>/<project>/<repository>/<package>@sha256:<digest>
    let [path, digest] = image.uri.split('@');
    let pkg = path.split('/').slice(3).join('/');

    await collectReferences(`${host}/${pkg}`, digest, token, referenced);
  }

  if (!referenced.size)
    throw new Error('No images found, so nothing is safe to delete');

  let files = await listAll(`${api}/${repository}/files`, token, 'files');
  let unused = findUnused(files, referenced, Date.now());
  let bytes = unused.reduce((sum, file) => sum + Number(file.sizeBytes || 0), 0);

  console.info(`${images.length} images use ${referenced.size} blobs. ${unused.length} of ${files.length} files are unused, ${(bytes / 1e6).toFixed(1)} MB.`);

  if (dryRun)
    return;

  let failed = 0;

  for (let file of unused) {
    try {
      await request(`${api}/${file.name}`, token, { 'method': 'DELETE' });
    } catch (e) {
      failed++;
      console.warn(e.message);
    }
  }

  console.info(`Deleted ${unused.length - failed}${failed ? `, ${failed} failed` : ''}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
