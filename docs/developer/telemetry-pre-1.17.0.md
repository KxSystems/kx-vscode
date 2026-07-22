---
type: Reference
title: Telemetry (Pre 1.17.0)
description: Legacy telemetry event names and the functions that emitted them, prior to extension version 1.17.0.
tags: [kdb, vscode, telemetry, legacy]
timestamp: 2026-07-10
---

# Telemetry (Pre 1.17.0)

| Telemetry                                    | Where                                            |
| :------------------------------------------- | :----------------------------------------------- |
| Extension.Activated                          | extension.activate                               |
| CustomAuth.Extension.Actived                 | extension.activate                               |
| Connection.Created.Insights                  | serverCommand.updateInsights                     |
| Connection.Created.QProcess                  | serverCommand.updateServers                      |
| Connection.Edited.Insights                   | serverCommand.editInsightsConnection             |
| Connection.Edited.KDB                        | serverCommand.editKdbConnection                  |
| Scratchpad.Execute.Python                    | serverCommand.executeQuery                       |
| Scratchpad.Execute.Python.Error              | serverCommand.executeQuery                       |
| Scratchpad.Execute.q                         | serverCommand.executeQuery                       |
| Scratchpad.Execute.q.Error                   | serverCommand.executeQuery                       |
| Workbook.Execute.Python                      | serverCommand.executeQuery                       |
| Workbook.Execute.Python.Error                | serverCommand.executeQuery                       |
| Workbook.Execute.q                           | serverCommand.executeQuery                       |
| Workbook.Execute.q.Error                     | serverCommand.executeQuery                       |
| GGPLOT.Display.Python                        | serverCommand.executeQuery                       |
| GGPLOT.Display.q                             | serverCommand.executeQuery                       |
| Workbook.Create.Python                       | workspace.addWorkspaceFile                       |
| Workbook.Create.q                            | workspace.addWorkspaceFile                       |
| Datasource.Created                           | dataSource.addDSToLocalFolder                    |
| Datasource.API.Run                           | dataSourceCommand.runDataSource                  |
| Datasource.QSQL.Run                          | dataSourceCommand.runDataSource                  |
| Datasource.SQL.Run                           | dataSourceCommand.runDataSource                  |
| Datasource.UDA.Run                           | dataSourceCommand.runDataSource                  |
| Datasource.API.Run.Error                     | dataSourceCommand.runDataSource                  |
| Datasource.QSQL.Run.Error                    | dataSourceCommand.runDataSource                  |
| Datasource.SQL.Run.Error                     | dataSourceCommand.runDataSource                  |
| Datasource.UDA.Run.Error                     | dataSourceCommand.runDataSource                  |
| Datasource.API.Scratchpad.Populated          | insightsConnection.importScratchpad              |
| Datasource.QSQL.Scratchpad.Populated         | insightsConnection.importScratchpad              |
| Datasource.SQL.Scratchpad.Populated          | insightsConnection.importScratchpad              |
| Datasource.UDA.Scratchpad.Populated          | insightsConnection.importScratchpad              |
| Datasource.API.Scratchpad.Populated.Errored  | insightsConnection.importScratchpad              |
| Datasource.QSQL.Scratchpad.Populated.Errored | insightsConnection.importScratchpad              |
| Datasource.SQL.Scratchpad.Populated.Errored  | insightsConnection.importScratchpad              |
| Datasource.UDA.Scratchpad.Populated.Errored  | insightsConnection.importScratchpad              |
| Scratchpad.Reseted                           | insightsConnection.resetScratchpad               |
| Connection.Connected.Active                  | ConnectionManagementService.setActiveConnection  |
| Connection.Connected.CustomAuth.KDB+         | ConnectionManagementService.connect              |
| Connection.Connected.CustomAuth.KDB+.Local   | ConnectionManagementService.connect              |
| Connection.Connected.Insights                | ConnectionManagementService.connect              |
| Connection.Connected.KDB+                    | ConnectionManagementService.connect              |
| Connection.Connected.KDB+.Local              | ConnectionManagementService.connect              |
| Connection.Failed.CustomAuth.KDB+            | ConnectionManagementService.connectFailBehaviour |
| Connection.Failed.CustomAuth.KDB+.Local      | ConnectionManagementService.connectFailBehaviour |
| Connection.Failed.Insights                   | ConnectionManagementService.connectFailBehaviour |
| Connection.Failed.KDB+                       | ConnectionManagementService.connectFailBehaviour |
| Connection.Failed.KDB+.Local                 | ConnectionManagementService.connectFailBehaviour |
| Connection.Disconnected.Insights             | ConnectionManagementService.disconnectBehaviour  |
| Connection.Disconnected.KDB                  | ConnectionManagementService.disconnectBehaviour  |
| Connections.Export.All                       | command kdb.connections.export.all               |
| Connections.Export.Single                    | command kdb.connections.export.single            |
| Connections.Import                           | command kdb.connections.import                   |
| Help&Feedback.Open.ExtensionDocumentation    | command kdb.help.openDocumentation               |
| Help&Feedback.Open.ReportBug                 | command kdb.help.reportBug                       |
| Help&Feedback.Open.SuggestFeature            | command kdb.help.suggestFeature                  |
| Help&Feedback.Open.Survey                    | command kdb.help.provideFeedback                 |
| Help&Feedback.Hide.Survey                    | feedbackSurveyUtils.showSurveyDialog             |
| Label.Assign.Connection                      | connLabel.addConnToLabel                         |
| Label.Cleanup.NoLabels                       | connLabel.clearWorkspaceLabels                   |
| Label.Cleanup.OrphanedMappings               | connLabel.clearWorkspaceLabels                   |
| Label.Create                                 | connLabel.createNewLabel                         |
| Label.Create.Exists                          | connLabel.createNewLabel                         |
| Label.Delete                                 | connLabel.deleteLabel                            |
| Label.Remove.Connection                      | connLabel.removeConnFromLabels                   |
| Label.Rename.Exists                          | connLabel.renameLabel                            |
| OpenSSL (Actual Error)                       | core.checkOpenSslInstalled                       |
