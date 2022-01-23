export const getMockType = (arg) => {
  return <jest.Mock<typeof arg>>arg
}
