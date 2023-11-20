# Apple Code Signing and Notarization Action

This action signs, notarizes, and/or staples Apple applications using the open source `rcodesign` tool from https://github.com/indygreg/apple-platform-rs/tree/main/apple-codesign.

This action can be run from Linux, Windows, and macOS Actions Runners.

This action is a thin veneer over downloading and invoking `rcodesign`.
Advanced customers may want to forego this action and invoke `rcodesign`
directly.

## Usage

You will likely want an Apple issued code signing certificate. See
https://gregoryszorc.com/docs/apple-codesign/stable/apple_codesign_certificate_management.html
for instructions on how to obtain one.

For notarizing, you will need an App Store Connect API Key. See
https://gregoryszorc.com/docs/apple-codesign/stable/apple_codesign_getting_started.html#obtaining-an-app-store-connect-api-key
for instructions on how to obtain one.

It is up to the caller to materialize a file/directory for
signing/notarizing/stapling.

It is up to the caller to do something with the file/directory operated on.

## Inputs and Outputs

See [action.yml](action.yml) for the set of inputs. The file should be
self-documenting.

The only output is `output_path`, which holds the filesystem path of the
signed/notarized/stapled entity.

## Examples

Ad-hoc signing.

```yaml
steps:
  # Add a step here to materialize a Mach-O binary, bundle, DMG, etc
  # that you want to sign.

  - name: Sign an Application Bundle
    uses: indygreg/apple-code-sign-action@v1
    with:
      input_path: MyApp.app
      output_path: dist/MyApp.app

  # MyApp.app should be signed, but without a code signing certificate.
```

Sign using a code signing certificate in a .p12/.pfx file.

```yaml
steps:
  # Add a step here to materialize a Mach-O binary, bundle, DMG, etc
  # that you want to sign.

  - name: Sign a Mach-O binary
    uses: indygreg/apple-code-sign-action@v1
    with:
      input_path: my-exe
      p12_file: cert.p12
      p12_password: ${{ secrets.certificate_password }}
```

Sign using a PEM encoded code signing certificate stored in a secret.

```yaml
steps:
  - name: Write PEM encoded private key data to a file
    env:
      # The secret has content:
      #
      # ```
      # -----BEGIN PRIVATE KEY-----
      # MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCkdCzwAgHcNbpH
      # ...
      # -----END PRIVATE KEY-----
      # ```
      #
      # Because of the way GitHub Actions secrets are stored, the newlines likely
      # get mangled to a single line. So we pipe to `tr` to translate whitespace
      # to newlines to restore the original format.
      SIGNING_KEY_PEM: ${{ secrets.SIGNING_KEY_PEM }}
    run: |
      echo $SIGNING_KEY_PEM | tr ' ' '\n' > key.pem

  # We assume the `-----BEGIN PUBLIC CERTIFICATE------` exists in a file named
  # `cert.pem`.
  #
  # The public certificate data is not a secret: the public certificate will be
  # embedded in code signatures. So you can safely check this data into version
  # control. You can also store it as a GitHub Secret: it doesn't really much
  # matter how you do it as long as code signing sees both the private key and
  # public certificate data.

  - name: Sign a Mach-O binary
    uses: indygreg/apple-code-sign-action@v1
    with:
      input_path: my-exe
      pem_file: |
        key.pem
        cert.pem
```

Sign on a remote machine (requires running `rcodesign remote-sign` on another machine when this action is running).

```yaml
steps:
  # Add a step here to materialize a Mach-O binary, bundle, DMG, etc
  # that you want to sign.

  - name: Sign a DMG
    uses: indygreg/apple-code-sign-action@v1
    with:
      input_path: MyApp.dmg
      remote_sign_public_key: |
        MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA6GIrYnjZ3mbcAJjmmEm/
        5jEp66vjs81MSt7AwVw381lteMoX9nzXVFuI4hwu7o41ZPuSqp+YvG90mMSVoTjy
        m6O1tVoD7m8X0fLdfBegZN7sePlgS34s9Sj0fEvNVjrwFimfWQ1RNR+JNogufeKZ
        IaePfb/hXBSbPxJrMVsCno6lUVuoFu2bJPMJUWxAsDhJLTyllJ5wzVc3MhzSL4OC
        3B4SCgv/QKi8R7cYIZlJHXZAyghRAO2jpa7PHOfCmCb1tT1Cs50OQlpk9XBv2xGV
        3r/2kqiG3Ay7cozX8V+oKZtzQHJQrqDVZNNXENcaPo7meoSCIdJhjd+leUI3iTLK
        hwIDAQAB
```

Sign, notarize, and staple an app bundle.

```yaml
steps:
  - name: Install App Store Connect API Key
    run: |
      mkdir -p private_keys/
      echo '${{ secrets.app_store_connect_key }}' > private_keys/AuthKey_DEADBEEF.p12

  - name: Sign and Notarize
    uses: indygreg/apple-code-sign-action@v1
    with:
      input_path: MyApp.app
      notarize: true
      staple: true
      p12_file: cert.p12
      p12_password: ${{ secrets.certificate_password }}
      # Find the issuer and key ID at https://appstoreconnect.apple.com/access/api.
      # The `AuthKey_XXXXXX.12` file created above must have the same `api_key` value listed here.
      app_store_connect_api_issuer: 'abcdef-42-2411312...'
      app_store_connect_api_key: 'DEADBEEF'
```
