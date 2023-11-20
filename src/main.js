const core = require('@actions/core')
const exec = require('@actions/exec')
const tool_cache = require('@actions/tool-cache')
const os = require('os')

async function getRcodesign(version) {
  const platform = os.platform()
  const arch = os.arch()

  let url =
    'https://github.com/indygreg/apple-platform-rs/releases/download/apple-codesign%2F'
  url += `${version}/apple-codesign-${version}-`
  let directory = `apple-codesign-${version}-`

  switch (platform) {
    case 'darwin':
      url += 'macos-universal.tar.gz'
      directory += 'macos-universal'
      break

    case 'linux':
      switch (arch) {
        case 'aarch64':
          url += 'aarch64-unknown-linux-musl.tar.gz'
          directory += 'aarch64-unknown-linux-musl'
          break
        case 'x64':
          url += 'x86_64-unknown-linux-musl.tar.gz'
          directory += 'x86_64-unknown-linux-musl'
          break
        default:
          throw new Error(`unsupported Linux architecture: ${arch}`)
      }
      break

    case 'win32':
      if (arch === 'x64') {
        url += 'x86_64-pc-windows-msvc.zip'
        directory += 'x86_64-pc-windows-msvc'
      } else {
        throw new Error(`unsupported Windows architecture: ${arch}`)
      }
      break

    default:
      throw new Error(`unsupported operating system: ${platform}`)
  }

  core.info(`Downloading rcodesign from ${url}`)

  const toolPath = await tool_cache.downloadTool(url)

  let destDir

  if (url.endsWith('.tar.gz')) {
    destDir = await tool_cache.extractTar(toolPath, 'rcodesign')
  } else {
    destDir = await tool_cache.extractZip(toolPath, 'rcodesign')
  }

  let exe = `${destDir}/${directory}/rcodesign`
  if (os.platform === 'win32') {
    exe += '.exe'
  }

  return exe
}

async function run() {
  try {
    const inputPath = core.getInput('input_path', { required: true })
    const outputPath = core.getInput('output_path')
    const sign = core.getBooleanInput('sign')
    const notarize = core.getBooleanInput('notarize')
    const staple = core.getBooleanInput('staple')
    const configFiles = core.getMultilineInput('config_file')
    const profile = core.getInput('profile')
    const pemFiles = core.getMultilineInput('pem_file')
    const p12File = core.getInput('p12_file')
    const p12Password = core.getInput('p12_password')
    const certificateDerFiles = core.getMultilineInput('certificate_der_file')
    const remoteSignPublicKey = core.getMultilineInput('remote_sign_public_key')
    const remoteSignPublicKeyPemFile = core.getInput(
      'remote_sign_public_key_pem_file'
    )
    const remoteSignSharedSecret = core.getInput('remote_sign_shared_secret')
    const appStoreConnectApiKeyJsonFile = core.getInput(
      'app_store_connect_api_key_json_file'
    )
    const appStoreConnectApiIssuer = core.getInput(
      'app_store_connect_api_issuer'
    )
    const appStoreConnectApiKey = core.getInput('app_store_connect_api_key')
    const signArgs = core.getMultilineInput('sign_args')
    const rcodesignVersion = core.getInput('rcodesign_version')

    const rcodesign = await getRcodesign(rcodesignVersion)

    let signedPath = inputPath

    if (sign) {
      const args = ['sign']

      for (const path of configFiles) {
        args.push('--config-file', path)
      }

      if (profile) {
        args.push('--profile', profile)
      }

      for (const path of pemFiles) {
        args.push('--pem-file', path)
      }
      if (p12File) {
        args.push('--p12-file', p12File)
      }
      if (p12Password) {
        args.push('--p12-password', p12Password)
      }
      for (const path of certificateDerFiles) {
        args.push('--certificate-der-file', path)
      }
      if (remoteSignPublicKey.length > 0) {
        args.push('--remote-public-key', remoteSignPublicKey.join(''))
      }
      if (remoteSignPublicKeyPemFile) {
        args.push('--remote-public-key-pem-file', remoteSignPublicKeyPemFile)
      }
      if (remoteSignSharedSecret) {
        args.push('--remote-shared-secret', remoteSignSharedSecret)
      }

      for (const arg of signArgs) {
        args.push(arg)
      }

      args.push(inputPath)

      if (outputPath) {
        args.push(outputPath)
        signedPath = outputPath
      }

      await exec.exec(rcodesign, args)
    }

    let stapled = false

    if (notarize) {
      if (!appStoreConnectApiKeyJsonFile) {
        throw new Error(
          'App Store Connect API Key not defined; cannot notarize'
        )
      }

      const args = ['notary-submit']

      for (const path of configFiles) {
        args.push('--config-file', path)
      }

      if (appStoreConnectApiKeyJsonFile) {
        args.push('--api-key-file', appStoreConnectApiKeyJsonFile)
      }
      if (appStoreConnectApiIssuer) {
        args.push('--api-issuer', appStoreConnectApiIssuer)
      }
      if (appStoreConnectApiKey) {
        args.push('--api-key', appStoreConnectApiKey)
      }

      if (staple) {
        args.push('--staple')
      } else {
        args.push('--wait')
      }

      args.push(signedPath)

      await exec.exec(rcodesign, args)

      if (staple) {
        stapled = true
      }
    }

    if (staple && !stapled) {
      const args = ['staple']

      for (const path of configFiles) {
        args.push('--config-file', path)
      }

      args.push(signedPath)

      await exec.exec(rcodesign, args)
    }

    core.setOutput('output_path', signedPath)
  } catch (error) {
    core.setFailed(error.message)
  }
}

module.exports = {
  run
}
