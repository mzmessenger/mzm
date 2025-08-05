type Options =
  | {
      type: 'top';
    }
  | {
      type: 'room';
      params: {
        roomName: string;
      };
    }

export const createRoutePath = (options: Options) => {
  switch (options.type) {
    case 'top':
      return '/'
    case 'room':
      return `/rooms/${options.params.roomName}`
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _exhaustiveCheck: never = options
      return ''
    }
  }
}
