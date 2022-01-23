import { isValidMimetype } from './icon'

test.each([['image/png'], ['image/jpeg']])(
  'isValidMimetype: success file type (%s)',
  async (mimetype) => {
    expect.assertions(1)

    const valid = isValidMimetype(mimetype)
    expect(valid).toStrictEqual(true)
  }
)

test.each([['image/svg+xml'], ['image/gif']])(
  'isValidMimetype: fail file type (%s)',
  async (mimetype) => {
    expect.assertions(1)

    const valid = isValidMimetype(mimetype)
    expect(valid).toStrictEqual(false)
  }
)
