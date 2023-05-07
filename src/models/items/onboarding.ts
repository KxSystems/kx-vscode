export const onboardingWorkflow = {
  prompt: (qhome: string) =>
    `Installation of q runtime completed successfully to ${qhome}`, // ${ext.context.globalStorageUri.fsPath}`,
  option1: "Start q",
  option2: "Cancel",
};

export const onboardingInput = {
  prompt: "Enter the desired port number for q",
  placeholder: "5001",
};
