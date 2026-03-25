let _io = null;

export const setIo = (io) => {
  _io = io;
};

export const getIo = () => {
  if (!_io) throw new Error("[Socket] io not initialized — call setIo first");
  return _io;
};
