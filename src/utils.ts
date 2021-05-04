export const censorEmail = function(email: string) {
  const arr = email.split('@');
  return censorWord(arr[0]) + '@' + censorWord(arr[1]);
};

export const censorWord = function(str: string) {
  if (str.length <= 2) return str;

  const chunk = Math.floor(str.length / 3);

  return str.slice(0, chunk) + '*'.repeat(str.length - chunk * 2) + str.slice(-1 * chunk);
};


export const sleep = (ms) => new Promise(res => setTimeout(res, ms));

export const timeRange = (min, max) => Math.floor(Math.random() * (max - min)) + min;