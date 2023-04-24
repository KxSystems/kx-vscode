export const onboardingWorkflow = {
  prompt: (qhome: string) => `Installation of Q runtime completed successfully to ${qhome}`, // ${ext.context.globalStorageUri.fsPath}`,
  option1: 'Start Q',
  option2: 'Cancel',
};

export const onboardingInput = {
  prompt: 'Enter the desired port number for Q',
  placeholder: '5001',
};
