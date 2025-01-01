NFTNode Lottery Manager System
==============================

This system manages multiple lottery contracts, triggering auto-spin events based on a predefined schedule (either Daily or Weekly). The main functionalities include scheduling executions, managing cron jobs, and sending notifications via Telegram.

Overview
--------

The **Lottery Manager** system allows the automated execution of lotteries by interacting with smart contracts on the Polygon blockchain. It checks each contract's scheduled execution time and performs actions such as auto-spins if the contract's scheduled time has passed. The system also provides periodic updates and handles errors efficiently.

File Structure
--------------

/lottery-manager
│
├── .env               # Environment configuration file
├── lotteryManager.js  # Main script that manages the lottery scheduling and execution

### Key Files

*   **lotteryManager.js**: Main script that schedules and executes the lottery actions for all contracts.
*   **.env**: Environment configuration file used to set up the system's parameters.

Environment Configuration
-------------------------

The **.env** file contains environment variables for configuring the system. Below is the structure for the **.env** file:

### .env

RPC=\`https://\` # RPC URL NODE
PRIVATE\_KEY=  # Executor and owner of the NFTs staked
LOTTERY\_TYPE="Daily" # NFT IDs type: from 1 to 10 - Weekly, from 11 to 50 - Daily
TELEGRAM\_BOT\_TOKEN='' # Get Api Token from https://t.me/BotFather on Telegram
TELEGRAM\_CHAT\_ID= # Get your user Chat Id on https://t.me/chatIDrobot

*   **LOTTERY\_TYPE**: Defines whether the system will manage daily or weekly lotteries. It should be set to either `Daily` or `Weekly`.
*   **TELEGRAM\_TOKEN**: Telegram Bot API token used to send messages.
*   **TELEGRAM\_CHAT\_ID**: The chat ID where notifications should be sent.

Setting Up the Environment
--------------------------

### 1\. Install Node.js

You need to install Node.js (which includes `npm`, the Node.js package manager). Follow the instructions for your operating system:

*   **Windows & macOS**: Download the installer from [Node.js official website](https://nodejs.org/), and run it. The installer will also install `npm`.
*   **Linux**: You can install Node.js using a package manager (for example, on Ubuntu):
    
        sudo apt update
        sudo apt install nodejs npm
        
    

### 2\. Install PM2 (optional, for process management)

PM2 is a process manager that helps keep your script running in the background, even after a system restart. You can install it globally with the following command:

npm install pm2 -g

### 3\. Clone the repository

Clone this repository to your local machine:

git clone https://github.com/Luckblocks/Node-Manager.git
cd Node-Manager

### 4\. Install required dependencies

Once inside the repository directory, install the necessary Node.js dependencies:

npm install

### 5\. Create the `.env` file

Create a **.env** file in the root directory and populate it with the appropriate values, as shown in the "Environment Configuration" section.

### 6\. Ensure ABI files and contract addresses are added

Make sure you have the correct ABI files and contract addresses added to the project for interaction with the smart contracts.

Running the Lottery Manager
---------------------------

To start the lottery manager, run the following command:

node lotteryManager.js

This will start the process of scheduling and executing the lottery actions.

### Using PM2 for Background Execution

You can use PM2 to run the script in the background and ensure it keeps running after system restarts. To run the script with PM2:

pm2 start lotteryManager.js --name "lottery-manager"

To check the status of the process, use:

pm2 status

To stop the process:

pm2 stop lottery-manager

Logging and Error Handling
--------------------------

The system logs messages to the console and sends updates to a specified Telegram chat. This includes:

*   Notifications for each contract being processed.
*   Alerts for errors or unexpected behavior.
*   Status updates on scheduled executions.

Cron Job Management
-------------------

The system uses cron jobs to handle the periodic execution of lottery checks. Each contract will have a cron job assigned, and the system ensures that the jobs are updated if any of the schedules change.

Contributing
------------

Feel free to fork this repository, create pull requests, and contribute improvements or bug fixes.

License
-------

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
