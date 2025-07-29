export default {
  transform: {
    "^.+\\.tsx?$": "ts-jest"
  },
  extensionsToTreatAsEsm: [".ts"],
  globals: {
    "ts-jest": {
      useESM: true
    }
  }
};