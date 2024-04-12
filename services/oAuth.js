// Google OAuth callback handler
const googleCallback = async (req, res) => {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send("Authorization code missing.");
    }
    try {
      // Get tokens
      oAuth2Client.getToken(code, async function (err, tokens) {
        if (err) {
          console.error("Error getting oAuth tokens:", err);
        }
        oAuth2Client.setCredentials(tokens);
  
        // Get list of emails
        const data = await getListOfMails(tokens);
        const messages = data.messages;
        const currentLabels = await axios.get(
          "https://gmail.googleapis.com/gmail/v1/users/me/labels",
          {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
            },
          }
        );
  
        // Extract existing label names
        const existingLabelNames = currentLabels.data.labels.map(
          (label) => label.name
        );
        const labelsToCreate = [
          "Interested",
          "Not Interested",
          "More Information",
        ].filter((label) => !existingLabelNames.includes(label));
  
        // Create new labels
        const createLabelPromises = labelsToCreate.map(async (label) => {
          await limiter.schedule(async () => {
            return axios.post(
              `https://gmail.googleapis.com/gmail/v1/users/me/labels`,
              {
                name: label,
              },
              {
                headers: {
                  Authorization: `Bearer ${tokens.access_token}`,
                },
              }
            );
          });
        });
  
        Promise.all(createLabelPromises)
          .then((responses) => {
            console.log("Labels created successfully:", responses);
          })
          .catch((error) => {
            console.error("Error creating labels:", error);
          });
  
        // Process each email
        messages.forEach(async (message) => {
          await limiter.schedule(async () => {
            const id = message.id;
            const mail = await getMail(id, tokens);
            const parsedMail = parseMail(mail);
            console.log(parsedMail);
            const label = await labelMail(tokens,id, parsedMail);
            console.log(label);
            let request = "";
            switch (label) {
              case "Interested":
                request = `Read ${parsedMail.emailContext} and write an email on behalf of Gunjan kumar,Reachinbox asking ${parsedMail.from.name}  if they are willing to hop on to a demo call by suggesting a time from Gunjan kumar`;
                break;
              case "Not Interested":
                request = `Read ${parsedMail.emailContext} and write an email on behalf of Gunjan kumar, Reachinbox thanking ${parsedMail.from.name} for their time and asking them if they would like to be contacted in the future from Gunjan kumar`;
                break;
              case "More information":
                request = `Read ${parsedMail.emailContext} and write an email on behalf of Gunjan kumar, Reachinbox asking ${parsedMail.from.name} if they would like more information about the product from Gunjan kumar`;
                break;
              default:
                request = `Read ${parsedMail.emailContext} and write an email on behalf of Gunjan kumar, Reachinbox asking ${parsedMail.from.name} if they are willing to hop on to a demo call by suggesting a time Gunjan kumar`;
            }
  
            setTimeout(async () => {
              const body = await writeMail(request);
              const details = {
                to: parsedMail.from.email,
                cc: parsedMail.cc,
                subject: parsedMail.subject,
                body: body,
              };
              init(details);
            }, 2000);
          });
        });
        res.send(
          `You have successfully authenticated with Google and Sent Replies to your Email. You can now close this tab.`
        );
      });
    } catch (error) {
      console.log(error);
    }
  };

  module.exports = googleCallback;